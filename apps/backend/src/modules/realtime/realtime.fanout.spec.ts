import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { GuildsService } from '../guilds/guilds.service';
import { RealtimeGateway } from './realtime.gateway';

/** Real Socket.IO server and clients; only the token verification and Guild lookup are faked. */
describe('RealtimeGateway fanout and session lifecycle over Socket.IO', () => {
  let app: INestApplication;
  let gateway: RealtimeGateway;
  let baseUrl: string;
  let sockets: Socket[];

  // The token is `<userId>|<sessionId>`.
  const identity = (token: string) => {
    const [sub, sessionId] = token.split('|');
    return { sub, email: '', sessionId };
  };

  beforeEach(async () => {
    sockets = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: ConfigService, useValue: { get: () => 'secret' } },
        { provide: JwtService, useValue: { verify: identity } },
        { provide: JwtStrategy, useValue: { validate: (payload: unknown) => Promise.resolve(payload) } },
        { provide: GuildsService, useValue: { findGuildIdOf: () => Promise.resolve(null) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    gateway = moduleRef.get(RealtimeGateway);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.close());
    await app.close();
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

  async function connect(userId: string, sessionId: string) {
    const socket = io(baseUrl, { auth: { token: `${userId}|${sessionId}` }, transports: ['websocket'], reconnection: false });
    const events: unknown[] = [];
    socket.on('progress:xpUpdated', (event) => events.push(event));
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    await settle();
    return { socket, events };
  }

  it('delivers progress:xpUpdated to every device of the user and to nobody else', async () => {
    const phone = await connect('ana', 's-phone');
    const laptop = await connect('ana', 's-laptop');
    const other = await connect('bruno', 's-other');

    gateway.emitToUser('ana', 'progress:xpUpdated', { xpGained: 50, xpTotal: 150, level: 2 });
    await settle();

    expect(phone.events).toEqual([{ xpGained: 50, xpTotal: 150, level: 2 }]);
    expect(laptop.events).toEqual([{ xpGained: 50, xpTotal: 150, level: 2 }]);
    expect(other.events).toEqual([]);
  });

  it('closes only the sockets of the revoked session', async () => {
    const phone = await connect('ana', 's-phone');
    const laptop = await connect('ana', 's-laptop');
    const other = await connect('bruno', 's-other');

    await gateway.disconnectSessions(['s-phone']);
    await settle();

    expect(phone.socket.connected).toBe(false);
    expect(laptop.socket.connected).toBe(true);
    expect(other.socket.connected).toBe(true);

    gateway.emitToUser('ana', 'progress:xpUpdated', { xpGained: 1, xpTotal: 1, level: 1 });
    await settle();
    expect(phone.events).toEqual([]);
    expect(laptop.events).toHaveLength(1);
  });
});
