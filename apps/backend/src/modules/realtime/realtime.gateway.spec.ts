import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RealtimeGateway } from './realtime.gateway';

type Middleware = (
  client: Socket,
  next: (error?: Error) => void,
) => void | Promise<void>;

function client(token?: string): Socket {
  return {
    data: {},
    connected: true,
    disconnect: jest.fn(),
    join: jest.fn(),
    handshake: { auth: token ? { token } : {}, query: {} },
  } as unknown as Socket;
}

describe('RealtimeGateway authentication', () => {
  function createGateway(
    payload: unknown = {
      sub: 'user-1',
      email: 'user@example.com',
      sessionId: 'session-1',
    },
  ) {
    const jwt = {
      verify: jest.fn().mockReturnValue(payload),
    } as unknown as JwtService;
    const config = {
      get: jest.fn().mockReturnValue('access-secret'),
    } as unknown as ConfigService;
    const jwtStrategy = {
      validate: jest.fn().mockResolvedValue(payload),
    } as unknown as JwtStrategy;

    return {
      gateway: new RealtimeGateway(jwt, config, jwtStrategy),
      jwt,
      jwtStrategy,
    };
  }

  function middlewareFor(gateway: RealtimeGateway): Middleware {
    let middleware: Middleware | undefined;
    const server = {
      use: jest.fn((registered: Middleware) => {
        middleware = registered;
      }),
    } as unknown as Server;
    gateway.afterInit(server);
    if (!middleware) {
      throw new Error('Realtime authentication middleware was not registered');
    }
    return middleware;
  }

  it('rejects a connection without a bearer identity before connection handlers run', async () => {
    const { gateway, jwt } = createGateway();
    const socket = client();
    const next = jest.fn();

    await middlewareFor(gateway)(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('uses the authenticated user and Session identity for the user room', async () => {
    const { gateway, jwt, jwtStrategy } = createGateway();
    const socket = client('access-token');
    const next = jest.fn();

    await middlewareFor(gateway)(socket, next);
    await gateway.handleConnection(socket);

    expect(jwt.verify).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(jwtStrategy.validate).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      sessionId: 'session-1',
    });
    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('joins the room of the user Guild on connection, as told by the registered resolver', async () => {
    const { gateway } = createGateway();
    const resolver = jest.fn().mockResolvedValue('guild-1');
    gateway.setGuildRoomResolver(resolver);
    const socket = client('access-token');

    await middlewareFor(gateway)(socket, jest.fn());
    await gateway.handleConnection(socket);

    expect(resolver).toHaveBeenCalledWith('user-1');
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.join).toHaveBeenCalledWith('guild:guild-1');
  });

  it('stays only in the user room when the user has no Guild or the lookup fails', async () => {
    const { gateway } = createGateway();
    const socket = client('access-token');
    await middlewareFor(gateway)(socket, jest.fn());

    gateway.setGuildRoomResolver(jest.fn().mockResolvedValue(null));
    await gateway.handleConnection(socket);
    gateway.setGuildRoomResolver(jest.fn().mockRejectedValue(new Error('db down')));
    await gateway.handleConnection(socket);

    expect((socket.join as jest.Mock).mock.calls).toEqual([['user:user-1'], ['user:user-1']]);
  });

  it('rejects a revoked Session before the Socket.IO connection is accepted', async () => {
    const { gateway, jwtStrategy } = createGateway();
    const socket = client('revoked-access-token');
    const next = jest.fn();
    (jwtStrategy.validate as jest.Mock).mockRejectedValue(new Error('revoked'));

    await middlewareFor(gateway)(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
