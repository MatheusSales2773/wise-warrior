import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsController } from '../guilds/guilds.controller';
import { GuildsService } from '../guilds/guilds.service';
import { ProgressionService } from '../progression/progression.service';
import { Mission } from '../raids/entities/mission.entity';
import { MissionRewardItem } from '../raids/entities/mission-reward-item.entity';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
import { EconomyService } from '../economy/economy.service';
import { Raid } from '../raids/entities/raid.entity';
import { RaidContribution } from '../raids/entities/raid-contribution.entity';
import { RaidParticipation } from '../raids/entities/raid-participation.entity';
import { RAID_CLOCK } from '../raids/raid-clock';
import { RaidsService } from '../raids/raids.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { StudySession } from '../sessions/entities/study-session.entity';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from './realtime.gateway';

type RaidProgressEvent = { raidId: string; progressXp: number; goalXp: number; goalReachedAt: string | null };

describe('raid:progress over Socket.IO against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let raids: RaidsService;
  let baseUrl: string;
  let sockets: Socket[];

  const ana = '00000000-0000-4000-8000-0000000f0a01';
  const bruno = '00000000-0000-4000-8000-0000000f0a02';
  const outsider = '00000000-0000-4000-8000-0000000f0a03';
  const NOW = new Date('2026-10-07T15:00:00Z');

  const call = (method: string, path: string, as: string, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: 'Bearer integration-token',
      'x-test-user-id': as,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  async function connect(userId: string): Promise<{ socket: Socket; events: RaidProgressEvent[] }> {
    const socket = io(baseUrl, { auth: { token: userId }, transports: ['websocket'], reconnection: false });
    const events: RaidProgressEvent[] = [];
    socket.on('raid:progress', (event: RaidProgressEvent) => events.push(event));
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    // The server joins the rooms right after the handshake; one round trip through the user room settles it.
    await settle();
    return { socket, events };
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

  async function contribute(guildId: string, userId: string, xp: number) {
    const raid = await dataSource!.getRepository(Raid).findOneByOrFail({ guildId, status: 'active' });
    await dataSource!.getRepository(RaidParticipation).createQueryBuilder().insert().values({ raidId: raid.id, userId }).orIgnore().execute();
    const studySessionId = randomUUID();
    await dataSource!.getRepository(StudySession).insert({ id: studySessionId, userId, mode: 'guild', raidId: raid.id, state: 'completed', xpAwarded: xp });
    await raids.recordContribution(raid.id, userId, studySessionId, xp);
    await settle();
    return raid;
  }

  beforeEach(async () => {
    sockets = [];
    database = await createIntegrationDatabase('wise_realtime_raid');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert(
      [[ana, 'Ana'], [bruno, 'Bruno'], [outsider, 'Otto']].map(([id, name]) => ({
        id: id!, email: `${name!.toLowerCase()}@example.com`, passwordHash: 'hash', displayName: name!, planTier: 'free',
      })),
    );

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_ACCESS_SECRET: 'secret' })] })],
      controllers: [GuildsController],
      providers: [
        RealtimeGateway,
        GuildsService,
        RaidsService,
        UsersService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission), repo(MissionRewardItem), repo(CoinBalance), repo(CoinLedgerEntry), EconomyService,
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => NOW },
        { provide: ProgressionService, useValue: {} },
        { provide: AuthService, useValue: {} },
        // The socket token is simply the user id.
        { provide: JwtService, useValue: { verify: (token: string) => ({ sub: token, email: '', sessionId: `session-${token}` }) } },
        { provide: JwtStrategy, useValue: { validate: (payload: JwtPayload) => Promise.resolve(payload) } },
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
    raids = moduleRef.get(RaidsService);

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.close());
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  const createGuild = async (as = ana) => (await (await call('POST', '/guilds', as, { name: 'Ordem do Foco' })).json() as { id: string }).id;

  it('delivers a Contribution to both members and not to an outsider, and stops after leaving', async () => {
    const guildId = await createGuild();
    await call('POST', `/guilds/${guildId}/members`, bruno);
    const anaClient = await connect(ana);
    const brunoClient = await connect(bruno);
    const outsiderClient = await connect(outsider);

    const raid = await contribute(guildId, ana, 120);

    const expected = { raidId: raid.id, progressXp: 120, goalXp: expect.any(Number), goalReachedAt: null };
    expect(anaClient.events).toEqual([expected]);
    expect(brunoClient.events).toEqual([expected]);
    expect(outsiderClient.events).toEqual([]);

    await call('DELETE', `/guilds/${guildId}/members/me`, bruno);
    await settle();
    await contribute(guildId, ana, 30);

    expect(anaClient.events).toHaveLength(2);
    expect(brunoClient.events).toHaveLength(1);
  });

  it('puts the sockets of a user in the Guild room when they create or join, without reconnecting', async () => {
    const [anaClient, brunoClient] = await Promise.all([connect(ana), connect(bruno)]);
    const secondBrunoDevice = await connect(bruno);

    const guildId = await createGuild(); // Ana had no Guild when she connected
    await call('POST', `/guilds/${guildId}/members`, bruno);
    await settle();
    await contribute(guildId, ana, 50);

    expect(anaClient.events).toHaveLength(1);
    expect(brunoClient.events).toHaveLength(1);
    expect(secondBrunoDevice.events).toHaveLength(1);
  });

  it('notifies every device of each Participant once when the Raid closes, and nobody else', async () => {
    type RaidCompleteEvent = { raidId: string; guildId: string; status: string; rewardItemId: string | null };
    const notices = (socket: Socket) => {
      const received: RaidCompleteEvent[] = [];
      socket.on('notification:raidComplete', (event: RaidCompleteEvent) => received.push(event));
      return received;
    };
    const guildId = await createGuild();
    await call('POST', `/guilds/${guildId}/members`, bruno);
    const anaPhone = notices((await connect(ana)).socket);
    const anaDesktop = notices((await connect(ana)).socket);
    const brunoNotices = notices((await connect(bruno)).socket);
    const outsiderNotices = notices((await connect(outsider)).socket);
    const active = await dataSource!.getRepository(Raid).findOneByOrFail({ guildId, status: 'active' });
    const raid = await contribute(guildId, ana, active.goalXp);
    await dataSource!.getRepository(RaidParticipation).insert({ raidId: raid.id, userId: bruno });

    const afterWeek = new Date(raid.endsAt.getTime() + 60_000);
    await raids.runWeeklyClose(afterWeek);
    await raids.runWeeklyClose(afterWeek);
    await settle();

    const reward = await dataSource!.getRepository(UserCosmeticItem).findOneByOrFail({ userId: ana });
    const anaNotice = { raidId: raid.id, guildId, status: 'completed', rewardItemId: reward.cosmeticItemId };
    expect(anaPhone).toEqual([anaNotice]);
    expect(anaDesktop).toEqual([anaNotice]);
    expect(brunoNotices).toEqual([{ ...anaNotice, rewardItemId: null }]);
    expect(outsiderNotices).toEqual([]);
  });

  it('joins the Guild room of a member at connection time', async () => {
    const guildId = await createGuild();
    const anaClient = await connect(ana);

    await contribute(guildId, ana, 10);

    expect(anaClient.events).toHaveLength(1);
  });
});
