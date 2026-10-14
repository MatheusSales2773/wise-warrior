import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsController } from '../guilds/guilds.controller';
import { GuildsService } from '../guilds/guilds.service';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { Mission } from './entities/mission.entity';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { GuildRaidsController } from './guild-raids.controller';
import { RAID_CLOCK } from './raid-clock';
import { RaidWeeklyJob } from './raid-weekly.job';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

type PastRaidsBody = {
  items: Array<{
    id: string;
    mission: { slug: string; name: string };
    status: string;
    startsAt: string;
    endsAt: string;
    me: { participated: boolean; contributionXp: number; position: number | null };
  }>;
  nextCursor: string | null;
};
type CatalogBody = Array<{ id: string; unlocked: boolean; equipped: boolean }>;

/** Marcador do Grimório: a Recompensa da Missão da semana de 05/10/2026 (Cerco ao Grimório). */
const GRIMORIO_REWARD = 'c05e71c0-0000-4000-8000-000000000009';
const APRENDIZ_TITLE = 'c05e71c0-0000-4000-8000-000000000002';

describe('Fechamento semanal, Recompensa de Raid e Raids anteriores against MySQL', () => {
  jest.setTimeout(60_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let now: Date;
  let guildId: string;
  let raidId: string;

  const ana = '00000000-0000-4000-8000-000000000e01';
  const bruno = '00000000-0000-4000-8000-000000000e02';
  const carla = '00000000-0000-4000-8000-000000000e03';
  const diego = '00000000-0000-4000-8000-000000000e04';
  const outsider = '00000000-0000-4000-8000-000000000e05';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = async <T>(method: string, path: string, as: string = ana) => {
    const response = await call(method, path, as);
    expect(response.status).toBe(200);
    return await response.json() as T;
  };

  let sessionCounter = 0;
  /** A Contribuição pelo caminho real da conclusão: incremento atômico e Meta batida na transação. */
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
    expect(progress).not.toBeNull();
  };
  const join = async (userId: string) => {
    expect((await call('POST', `/raids/${raidId}/join`, userId)).status).toBe(204);
  };
  const catalog = (as: string) => json<CatalogBody>('GET', '/users/me/cosmetics', as);
  const reward = async (as: string) => (await catalog(as)).find((item) => item.id === GRIMORIO_REWARD);

  beforeEach(async () => {
    now = new Date('2026-10-07T15:00:00Z');
    database = await createIntegrationDatabase('wise_raid_closing');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const everyone = [ana, bruno, carla, diego, outsider];
    const names = ['Ana', 'Bruno', 'Carla', 'Diego', 'Fora'];
    await dataSource.getRepository(User).insert(everyone.map((id, index) => ({
      id, email: `lifecycle${index}@example.com`, passwordHash: 'hash', displayName: names[index]!, planTier: 'free' as const,
    })));
    await dataSource.getRepository(Character).insert(everyone.map((userId, index) => ({
      userId, level: index === 0 ? 3 : 1, xpTotal: index === 0 ? 1200 : 0,
    })));
    await dataSource.getRepository(UserCosmeticItem).insert({ userId: ana, cosmeticItemId: APRENDIZ_TITLE, equipped: true });

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController, UsersController],
      providers: [
        GuildsService,
        RaidsService,
        RaidWeeklyJob,
        UsersService,
        ProgressionService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem), repo(Character),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: AuthService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn() } },
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

    guildId = (await (await call('POST', '/guilds', ana, { name: 'Ordem do Foco' })).json() as { id: string }).id;
    for (const member of [bruno, carla, diego]) {
      expect((await call('POST', `/guilds/${guildId}/members`, member)).status).toBe(204);
    }
    raidId = (await json<{ id: string }>('GET', `/guilds/${guildId}/raids/active`)).id;
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  describe('fechamento semanal', () => {
    const weekTurn = new Date('2026-10-12T03:00:00Z'); // Monday 00:00 in São Paulo
    const guildLevel = async () => (await json<{ guild: { level: number } }>('GET', '/guilds/me')).guild.level;

    it('closes a Raid with the goal reached as completed, levels the Guild up and rewards only members with a Contribution', async () => {
      for (const member of [ana, bruno, carla, diego]) await join(member);
      await contribute(ana, 900);
      await contribute(bruno, 1500); // past the goal of 1.000, frozen when the Guild was founded alone
      await contribute(diego, 2000);
      expect((await json<{ goalReachedAt: string | null }>('GET', `/guilds/${guildId}/raids/active`)).goalReachedAt).not.toBeNull();
      expect((await call('DELETE', `/guilds/${guildId}/members/me`, diego)).status).toBe(204);

      now = weekTurn;
      await app!.get(RaidWeeklyJob).handleWeekStart();

      expect(await dataSource!.getRepository(Raid).findOneByOrFail({ id: raidId })).toMatchObject({ status: 'completed' });
      expect(await guildLevel()).toBe(2);
      expect(await reward(ana)).toMatchObject({ unlocked: true, equipped: false });
      expect(await reward(bruno)).toMatchObject({ unlocked: true, equipped: false });
      expect(await reward(carla)).toMatchObject({ unlocked: false }); // confirmed, never contributed
      expect(await reward(diego)).toMatchObject({ unlocked: false }); // left the Guild

      // The next week's Raid: the next Missão of the rotation, the full goal for the 3 members left.
      const next = await json<{ id: string; mission: { slug: string }; goalXp: number; status: string }>('GET', `/guilds/${guildId}/raids/active`);
      expect(next).toMatchObject({ mission: { slug: 'marcha-do-silencio' }, goalXp: 4500, status: 'active' });
      expect(next.id).not.toBe(raidId);
    });

    it('is idempotent: running again, or winning the same Missão again, duplicates neither level, Raid nor item', async () => {
      await join(ana);
      await contribute(ana, 4000);
      now = weekTurn;
      await app!.get(RaidWeeklyJob).handleWeekStart();
      await app!.get(RaidWeeklyJob).handleWeekStart();
      await app!.get(RaidsService).runWeeklyRollover();

      expect(await guildLevel()).toBe(2);
      expect(await dataSource!.getRepository(Raid).countBy({ guildId })).toBe(2);
      expect(await dataSource!.getRepository(UserCosmeticItem).countBy({ userId: ana, cosmeticItemId: GRIMORIO_REWARD })).toBe(1);

      // A later win of the same Missão keeps a single Inventory row, still not equipped.
      await app!.get(UsersService).unlockRaidReward(dataSource!.manager, [ana], 'cerco-ao-grimorio');
      expect(await dataSource!.getRepository(UserCosmeticItem).findBy({ userId: ana, cosmeticItemId: GRIMORIO_REWARD }))
        .toEqual([expect.objectContaining({ equipped: false })]);
    });

    it('closes a Raid without the goal reached as expired, with no level and no reward', async () => {
      await join(ana);
      await join(carla);
      await contribute(ana, 100);
      now = weekTurn;
      await app!.get(RaidWeeklyJob).handleWeekStart();

      expect(await dataSource!.getRepository(Raid).findOneByOrFail({ id: raidId })).toMatchObject({ status: 'expired' });
      expect(await guildLevel()).toBe(1);
      expect(await reward(ana)).toMatchObject({ unlocked: false });
    });

    it('closes a Raid nobody touched as expired', async () => {
      now = weekTurn;
      await app!.get(RaidWeeklyJob).handleWeekStart();
      expect(await dataSource!.getRepository(Raid).findOneByOrFail({ id: raidId })).toMatchObject({ status: 'expired' });
    });

    it('recovers missed weeks when the application starts', async () => {
      now = new Date('2026-10-28T15:00:00Z'); // Wednesday, two weeks after the Raid ended
      await app!.get(RaidWeeklyJob).onApplicationBootstrap();

      const raids = await dataSource!.getRepository(Raid).find({ where: { guildId }, order: { startsAt: 'ASC' } });
      expect(raids.map((raid) => [raid.status, raid.startsAt.toISOString()])).toEqual([
        ['expired', '2026-10-05T03:00:00.000Z'],
        ['active', '2026-10-26T03:00:00.000Z'],
      ]);
      // Proportional: 4 members × 1.500 XP × 108 h left of 168 h, up to a multiple of 50.
      expect(raids[1]!.goalXp).toBe(3900);
    });

    it('rejects a Contribution after the Raid closed', async () => {
      await join(ana);
      now = weekTurn;
      await app!.get(RaidWeeklyJob).handleWeekStart();
      now = new Date('2026-10-11T12:00:00Z'); // a late completion still dated inside the closed week
      sessionCounter += 1;
      const studySessionId = `00000000-0000-4000-8000-${String(sessionCounter).padStart(12, '0')}`;
      await dataSource!.query(
        "INSERT INTO study_sessions (id, user_id, subject, mode, raid_id, started_at) VALUES (?, ?, NULL, 'guild', ?, NOW())",
        [studySessionId, ana, raidId],
      );
      const progress = await dataSource!.transaction((manager) => app!.get(RaidsService).recordContributionInTransaction(manager, {
        raidId, userId: ana, studySessionId, xpContributed: 100, endedAt: now,
      }));
      expect(progress).toBeNull();
    });
  });

  describe('Raids anteriores', () => {
    it('lists closed Raids from the newest, with the member own position and Contribution', async () => {
      for (const member of [ana, bruno, carla]) await join(member);
      await contribute(bruno, 4000);
      await contribute(ana, 100);
      now = new Date('2026-10-12T03:00:00Z');
      await app!.get(RaidWeeklyJob).handleWeekStart();
      now = new Date('2026-10-19T03:00:00Z');
      await app!.get(RaidWeeklyJob).handleWeekStart();

      const page = await json<PastRaidsBody>('GET', `/guilds/${guildId}/raids`, ana);
      expect(page.items.map((raid) => [raid.mission.slug, raid.status, raid.startsAt, raid.me])).toEqual([
        ['marcha-do-silencio', 'expired', '2026-10-12T03:00:00.000Z', { participated: false, contributionXp: 0, position: null }],
        ['cerco-ao-grimorio', 'completed', '2026-10-05T03:00:00.000Z', { participated: true, contributionXp: 100, position: 2 }],
      ]);
      expect(page.nextCursor).toBeNull();
      expect((await json<PastRaidsBody>('GET', `/guilds/${guildId}/raids`, carla)).items[1]!.me)
        .toEqual({ participated: true, contributionXp: 0, position: 3 });

      const first = await json<PastRaidsBody>('GET', `/guilds/${guildId}/raids?limit=1`);
      expect(first.items.map((raid) => raid.mission.slug)).toEqual(['marcha-do-silencio']);
      const second = await json<PastRaidsBody>('GET', `/guilds/${guildId}/raids?limit=1&cursor=${encodeURIComponent(first.nextCursor!)}`);
      expect(second.items.map((raid) => raid.mission.slug)).toEqual(['cerco-ao-grimorio']);
      expect(second.nextCursor).toBeNull();
    });

    it('answers an empty list while no Raid has closed', async () => {
      expect(await json<PastRaidsBody>('GET', `/guilds/${guildId}/raids`)).toEqual({ items: [], nextCursor: null });
    });
  });
});
