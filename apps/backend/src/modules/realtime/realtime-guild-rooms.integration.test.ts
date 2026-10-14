import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy, type JwtPayload } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsController } from '../guilds/guilds.controller';
import { GuildsService } from '../guilds/guilds.service';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import { Mission } from '../raids/entities/mission.entity';
import { Raid } from '../raids/entities/raid.entity';
import { RaidContribution } from '../raids/entities/raid-contribution.entity';
import { RaidParticipation } from '../raids/entities/raid-participation.entity';
import { GuildRaidsController } from '../raids/guild-raids.controller';
import { RAID_CLOCK } from '../raids/raid-clock';
import { RaidsController } from '../raids/raids.controller';
import { RaidsService } from '../raids/raids.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from './realtime.gateway';

/** How long a client waits before concluding that an event did not reach it. */
const SILENCE_MS = 400;

describe('Tempo real da Guilda (Socket.IO) against MySQL', () => {
  jest.setTimeout(60_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let now: Date;
  let guildId: string;
  let raidId: string;
  const clients: ClientSocket[] = [];

  const ana = '00000000-0000-4000-8000-000000000f01';
  const bruno = '00000000-0000-4000-8000-000000000f02';
  const carla = '00000000-0000-4000-8000-000000000f03';

  const call = (method: string, path: string, as: string, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: 'Bearer integration-token',
      'x-test-user-id': as,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  /** A connected device of `userId`; the test JWT is the user id itself. */
  const connect = async (userId: string): Promise<ClientSocket> => {
    const client = io(baseUrl, { auth: { token: userId }, transports: ['websocket'], reconnection: false, forceNew: true });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });
    // The guild room is joined after an asynchronous membership lookup.
    await new Promise((resolve) => setTimeout(resolve, 100));
    return client;
  };

  /** Resolves with the payloads `client` received for `event` while `action` ran, after a quiet period. */
  const received = async (client: ClientSocket, event: string, action: () => Promise<unknown>) => {
    const payloads: unknown[] = [];
    const listener = (payload: unknown) => payloads.push(payload);
    client.on(event, listener);
    await action();
    await new Promise((resolve) => setTimeout(resolve, SILENCE_MS));
    client.off(event, listener);
    return payloads;
  };

  let sessionCounter = 0;
  /** The completion path: the Contribution commits, then `raid:progress` goes out. */
  const contribute = async (userId: string, xp: number) => {
    sessionCounter += 1;
    const studySessionId = `00000000-0000-4000-8000-${String(sessionCounter).padStart(12, '0')}`;
    await dataSource!.query(
      "INSERT INTO study_sessions (id, user_id, subject, mode, raid_id, started_at) VALUES (?, ?, NULL, 'guild', ?, NOW())",
      [studySessionId, userId, raidId],
    );
    const raids = app!.get(RaidsService);
    const progress = await dataSource!.transaction((manager) => raids.recordContributionInTransaction(manager, {
      raidId, userId, studySessionId, xpContributed: xp, endedAt: now,
    }));
    raids.publishProgress(progress!);
  };

  beforeEach(async () => {
    now = new Date();
    database = await createIntegrationDatabase('wise_realtime_rooms');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const everyone = [ana, bruno, carla];
    await dataSource.getRepository(User).insert(everyone.map((id, index) => ({
      id, email: `rooms${index}@example.com`, passwordHash: 'hash', displayName: `User ${index}`, planTier: 'free' as const,
    })));
    await dataSource.getRepository(Character).insert(everyone.map((userId) => ({ userId, level: 1, xpTotal: 0 })));

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController],
      providers: [
        RealtimeGateway,
        GuildsService,
        RaidsService,
        UsersService,
        ProgressionService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem), repo(Character),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ConfigService, useValue: { get: () => 'access-secret' } },
        // The access token of these tests is the user id; the Session is always valid.
        { provide: JwtService, useValue: { verify: (token: string) => ({ sub: token, sessionId: `session-${token}` }) } },
        { provide: JwtStrategy, useValue: { validate: async (payload: JwtPayload) => payload } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: JwtPayload;
          }>();
          if (request.headers.authorization !== 'Bearer integration-token') throw new UnauthorizedException();
          request.user = { sub: request.headers['x-test-user-id']! } as JwtPayload;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

    guildId = (await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string }).id;
    expect((await call('POST', `/guilds/${guildId}/members`, bruno)).status).toBe(204);
    raidId = (await (await call('GET', `/guilds/${guildId}/raids/active`, ana)).json() as { id: string }).id;
    for (const member of [ana, bruno]) expect((await call('POST', `/raids/${raidId}/join`, member)).status).toBe(204);
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('delivers raid:progress to every connected member device and not to an outsider', async () => {
    const anaDevice = await connect(ana);
    const brunoPhone = await connect(bruno);
    const brunoDesktop = await connect(bruno);
    const outsider = await connect(carla);

    const [toAna, toPhone, toDesktop, toOutsider] = await Promise.all([
      received(anaDevice, 'raid:progress', async () => undefined),
      received(brunoPhone, 'raid:progress', async () => undefined),
      received(brunoDesktop, 'raid:progress', async () => undefined),
      received(outsider, 'raid:progress', () => contribute(bruno, 150)),
    ]);

    const expected = { raidId, progressXp: 150, goalXp: expect.any(Number), goalReachedAt: null };
    expect(toAna).toEqual([expected]);
    expect(toPhone).toEqual([expected]);
    expect(toDesktop).toEqual([expected]);
    expect(toOutsider).toEqual([]);
  });

  it('moves the sockets between guild rooms on join and leave, without reconnecting', async () => {
    const carlaDevice = await connect(carla);
    const brunoDevice = await connect(bruno);

    expect((await call('POST', `/guilds/${guildId}/members`, carla)).status).toBe(204);
    expect((await call('DELETE', `/guilds/${guildId}/members/me`, bruno)).status).toBe(204);

    const [toCarla, toBruno] = await Promise.all([
      received(carlaDevice, 'raid:progress', async () => undefined),
      received(brunoDevice, 'raid:progress', () => contribute(ana, 100)),
    ]);
    expect(toCarla).toEqual([expect.objectContaining({ raidId, progressXp: 100 })]);
    expect(toBruno).toEqual([]);
    expect(carlaDevice.connected && brunoDevice.connected).toBe(true);
  });

  it('puts the founder of a new Guild in its room right away', async () => {
    const carlaDevice = await connect(carla);
    const created = await call('POST', '/guilds', carla, { name: 'Guilda Nova' });
    expect(created.status).toBe(201);
    const newGuildId = (await created.json() as { id: string }).id;
    const newRaidId = (await (await call('GET', `/guilds/${newGuildId}/raids/active`, carla)).json() as { id: string }).id;
    expect((await call('POST', `/raids/${newRaidId}/join`, carla)).status).toBe(204);

    raidId = newRaidId;
    const toCarla = await received(carlaDevice, 'raid:progress', () => contribute(carla, 50));
    expect(toCarla).toEqual([expect.objectContaining({ raidId: newRaidId, progressXp: 50 })]);
  });

  it('sends notification:raidComplete to both devices of a Participant once, and not to an outsider', async () => {
    const brunoPhone = await connect(bruno);
    const brunoDesktop = await connect(bruno);
    const outsider = await connect(carla);
    await contribute(bruno, 5000);

    now = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // past the end of the week
    const closeTwice = async () => {
      await app!.get(RaidsService).runWeeklyRollover();
      await app!.get(RaidsService).runWeeklyRollover();
    };
    const [toPhone, toDesktop, toOutsider] = await Promise.all([
      received(brunoPhone, 'notification:raidComplete', async () => undefined),
      received(brunoDesktop, 'notification:raidComplete', async () => undefined),
      received(outsider, 'notification:raidComplete', closeTwice),
    ]);

    const expected = { raidId, guildId, status: 'completed', rewardItemId: expect.any(String) };
    expect(toPhone).toEqual([expected]);
    expect(toDesktop).toEqual([expected]);
    expect(toOutsider).toEqual([]);
  });
});
