import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RealtimeGateway } from './realtime.gateway';

function client(): Socket {
  return {
    data: {},
    disconnect: jest.fn(),
    join: jest.fn(),
    handshake: { auth: {}, query: {} },
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

  it('rejects a connection without a bearer identity', async () => {
    const { gateway, jwt } = createGateway();
    const socket = client();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('uses the authenticated user and Session identity for the user room', async () => {
    const { gateway, jwt, jwtStrategy } = createGateway();
    const socket = client();
    socket.handshake.auth = { token: 'access-token' };

    await gateway.handleConnection(socket);

    expect(jwt.verify).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(jwtStrategy.validate).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      sessionId: 'session-1',
    });
    expect(socket.data).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when the shared JWT strategy rejects the Session', async () => {
    const { gateway, jwtStrategy } = createGateway();
    const socket = client();
    socket.handshake.auth = { token: 'revoked-access-token' };
    (jwtStrategy.validate as jest.Mock).mockRejectedValue(new Error('revoked'));

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.join).not.toHaveBeenCalled();
  });
});
