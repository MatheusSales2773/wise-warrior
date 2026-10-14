import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsController } from '../guilds/guilds.controller';
import { GuildsService } from '../guilds/guilds.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ProgressionService } from '../progression/progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Mission } from './entities/mission.entity';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { RAID_CLOCK } from './raid-clock';
import { GuildRaidsController } from './guild-raids.controller';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

type PastRaidPage = {
  items: Array<{
    id: string;
    mission: { slug: string; name: string };
    startsAt: string;
    endsAt: string;
    status: 'completed' | 'expired';
    goalXp: number;
    progressXp: number;
    me: { participated: boolean; contributionXp: number; position: number | null };
  }>;
  nextCursor: string | null;
};

describe('Fechamento semanal da Raid against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let service: RaidsService;
  let baseUrl: string;
  let now: Date;

  // Week W: Monday 2026-10-05 00:00 to Sunday 2026-10-11 23:59:59 in São Paulo (UTC-3).
  const WEDNESDAY_W = new Date('2026-10-07T15:00:00Z');
  const START_W1 = new Date('2026-10-12T03:00:00Z');
  const JUST_AFTER_W = new Date('2026-10-12T03:00:30Z');
  const JUST_AFTER_W1 = new Date('2026-10-19T03:00:30Z');

  const ana = '00000000-0000-4000-8000-000000000d01';
  const bruno = '00000000-0000-4000-8000-000000000d02';
  const outsider = '00000000-0000-4000-8000-000000000d09';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const createGuild = async (name: string, as = ana) => (await (await call('POST', '/guilds', as, { name })).json() as { id: string }).id;
  const raidsOf = (guildId: string) => dataSource!.getRepository(Raid).find({ where: { guildId }, relations: ['mission'], order: { startsAt: 'ASC' } });
  const levelOf = async (guildId: string) => (await dataSource!.getRepository(Guild).findOneByOrFail({ id: guildId })).level;
  const reachGoal = (raidId: string) => dataSource!.getRepository(Raid).update({ id: raidId }, { progressXp: 2000, goalReachedAt: new Date('2026-10-09T12:00:00Z') });

  async function contribute(raidId: string, userId: string, xp: number, createdAt: string) {
    await dataSource!.getRepository(RaidParticipation).createQueryBuilder().insert().values({ raidId, userId }).orIgnore().execute();
    await dataSource!.query(
      'INSERT INTO raid_contributions (id, raid_id, user_id, xp_contributed, created_at) VALUES (UUID(), ?, ?, ?, ?)',
      [raidId, userId, xp, createdAt],
    );
    await dataSource!.query('UPDATE raids SET progress_xp = progress_xp + ? WHERE id = ?', [xp, raidId]);
  }

  beforeEach(async () => {
    now = WEDNESDAY_W;
    database = await createIntegrationDatabase('wise_raid_weekly_close');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
      { id: outsider, email: 'fora@example.com', passwordHash: 'hash', displayName: 'Fora', planTier: 'free' },
    ]);

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController],
      providers: [
        GuildsService,
        RaidsService,
        UsersService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ProgressionService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn(), emitToUser: jest.fn(), setGuildRoomResolver: jest.fn(), joinGuildRoom: jest.fn(), leaveGuildRoom: jest.fn() } },
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
    service = moduleRef.get(RaidsService);

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('does nothing while the week is still running', async () => {
    const guildId = await createGuild('Ordem do Foco');

    expect(await service.runWeeklyClose(WEDNESDAY_W)).toMatchObject({ closed: 0, opened: 0 });
    expect((await raidsOf(guildId)).map((raid) => raid.status)).toEqual(['active']);
  });

  it('closes a Raid with Meta batida as completed, raises the Nível da Guild and opens next week with the next Missão', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await call('POST', `/guilds/${guildId}/members`, bruno);
    const [current] = await raidsOf(guildId);
    await reachGoal(current!.id);

    const result = await service.runWeeklyClose(JUST_AFTER_W);

    expect(result).toMatchObject({ closed: 1, opened: 0, closings: [{ raidId: current!.id, guildId, status: 'completed' }] });
    expect(await levelOf(guildId)).toBe(2);
    const [closed, next] = await raidsOf(guildId);
    expect(closed).toMatchObject({ id: current!.id, status: 'completed' });
    expect(next).toMatchObject({ status: 'active', progressXp: 0, goalReachedAt: null, goalXp: 3000 });
    expect(next!.startsAt.getTime()).toBe(START_W1.getTime());
    expect(next!.mission.slug).toBe('marcha-do-silencio');
    expect(closed!.mission.slug).toBe('cerco-ao-grimorio');
  });

  it('closes a Raid without any Contribution as expired and leaves the Nível alone', async () => {
    const guildId = await createGuild('Ordem do Foco');

    await service.runWeeklyClose(JUST_AFTER_W);

    expect((await raidsOf(guildId)).map((raid) => raid.status)).toEqual(['expired', 'active']);
    expect(await levelOf(guildId)).toBe(1);
  });

  it('closes a Raid that fell short of the goal as expired', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const [current] = await raidsOf(guildId);
    await contribute(current!.id, ana, 100, '2026-10-08 12:00:00.000000');

    await service.runWeeklyClose(JUST_AFTER_W);

    expect((await raidsOf(guildId))[0]!.status).toBe('expired');
    expect(await levelOf(guildId)).toBe(1);
  });

  it('is idempotent: closing twice raises one level and opens one Raid', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await reachGoal((await raidsOf(guildId))[0]!.id);

    await service.runWeeklyClose(JUST_AFTER_W);
    expect(await service.runWeeklyClose(JUST_AFTER_W)).toMatchObject({ closed: 0, opened: 0 });

    expect(await raidsOf(guildId)).toHaveLength(2);
    expect(await levelOf(guildId)).toBe(2);
  });

  it('stays exact when two closings run at the same time', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await reachGoal((await raidsOf(guildId))[0]!.id);

    const results = await Promise.all([service.runWeeklyClose(JUST_AFTER_W), service.runWeeklyClose(JUST_AFTER_W)]);

    expect(results.reduce((sum, result) => sum + result.closed, 0)).toBe(1);
    expect(await raidsOf(guildId)).toHaveLength(2);
    expect(await levelOf(guildId)).toBe(2);
  });

  it('catches up after downtime: closes the overdue Raid and opens only the current week, with a proportional goal', async () => {
    const guildId = await createGuild('Ordem do Foco');
    // Two weeks later, on Thursday 2026-10-22 12:00 in São Paulo.
    const thursdayTwoWeeksLater = new Date('2026-10-22T15:00:00Z');

    await service.runWeeklyClose(thursdayTwoWeeksLater);

    const raids = await raidsOf(guildId);
    expect(raids.map((raid) => raid.status)).toEqual(['expired', 'active']);
    expect(raids[1]!.startsAt.getTime()).toBe(new Date('2026-10-19T03:00:00Z').getTime());
    expect(raids[1]!.goalXp).toBeLessThan(1500);
  });

  it('opens the Raid of the week for a Guild that has none', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await dataSource!.getRepository(Raid).delete({ guildId });

    expect(await service.runWeeklyClose(WEDNESDAY_W)).toMatchObject({ closed: 0, opened: 1 });
    expect((await raidsOf(guildId)).map((raid) => raid.status)).toEqual(['active']);
  });

  describe('GET /guilds/:id/raids (Raids anteriores)', () => {
    async function guildWithTwoClosedWeeks() {
      const guildId = await createGuild('Ordem do Foco');
      await call('POST', `/guilds/${guildId}/members`, bruno);
      const [week0] = await raidsOf(guildId);
      await contribute(week0!.id, bruno, 300, '2026-10-08 12:00:00.000000');
      await reachGoal(week0!.id);
      await service.runWeeklyClose(JUST_AFTER_W);
      const week1 = (await raidsOf(guildId))[1]!;
      await contribute(week1.id, ana, 100, '2026-10-14 12:00:00.000000');
      await service.runWeeklyClose(JUST_AFTER_W1);
      now = JUST_AFTER_W1;
      return { guildId, week0: week0!, week1 };
    }

    it('lists the closed Raids, most recent first, with the caller result in each', async () => {
      const { guildId, week0, week1 } = await guildWithTwoClosedWeeks();

      const page = await (await call('GET', `/guilds/${guildId}/raids`, bruno)).json() as PastRaidPage;

      expect(page.nextCursor).toBeNull();
      expect(page.items.map((raid) => [raid.id, raid.status, raid.mission.slug])).toEqual([
        [week1.id, 'expired', 'marcha-do-silencio'],
        [week0.id, 'completed', 'cerco-ao-grimorio'],
      ]);
      expect(page.items[0]!.me).toEqual({ participated: false, contributionXp: 0, position: null });
      expect(page.items[1]!.me).toEqual({ participated: true, contributionXp: 300, position: 1 });
      expect(new Date(page.items[1]!.startsAt).getTime()).toBe(new Date('2026-10-05T03:00:00Z').getTime());
    });

    it('leaves the active Raid out and pages with a cursor', async () => {
      const { guildId, week0, week1 } = await guildWithTwoClosedWeeks();

      const first = await (await call('GET', `/guilds/${guildId}/raids?limit=1`, ana)).json() as PastRaidPage;
      const second = await (await call('GET', `/guilds/${guildId}/raids?limit=1&cursor=${first.nextCursor}`, ana)).json() as PastRaidPage;

      expect(first.items.map((raid) => raid.id)).toEqual([week1.id]);
      expect(first.items[0]!.me).toEqual({ participated: true, contributionXp: 100, position: 1 });
      expect(second.items.map((raid) => raid.id)).toEqual([week0.id]);
      expect(second.nextCursor).toBeNull();
    });

    it('is restricted to members and validates its query', async () => {
      const { guildId } = await guildWithTwoClosedWeeks();

      expect((await call('GET', `/guilds/${guildId}/raids`, null)).status).toBe(401);
      expect((await call('GET', `/guilds/${guildId}/raids`, outsider)).status).toBe(403);
      expect((await call('GET', `/guilds/${guildId}/raids?cursor=nope`, ana)).status).toBe(400);
      expect((await call('GET', `/guilds/${guildId}/raids?limit=21`, ana)).status).toBe(400);
    });

    it('shows the raised Nível on the Guild', async () => {
      const { guildId } = await guildWithTwoClosedWeeks();

      expect(await (await call('GET', '/guilds/me', ana)).json()).toMatchObject({ guild: { id: guildId, level: 2 } });
    });
  });
});
