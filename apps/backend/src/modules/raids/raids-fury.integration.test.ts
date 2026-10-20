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
import { MissionRewardItem } from './entities/mission-reward-item.entity';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
import { EconomyService } from '../economy/economy.service';
import { Raid } from './entities/raid.entity';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { RAID_CLOCK } from './raid-clock';
import { GuildRaidsController } from './guild-raids.controller';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

import { StudySession } from '../sessions/entities/study-session.entity';

describe('Fúria do dragão against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let service: RaidsService;
  let baseUrl: string;
  let now: Date;

  // Week W: Monday 2026-10-05 00:00 to Sunday 2026-10-11 23:59:59 in São Paulo (UTC-3).
  const MONDAY_W = new Date('2026-10-05T03:00:00Z');
  const at = (day: string, hour = 12) => new Date(`2026-10-${day}T${String(hour + 3).padStart(2, '0')}:00:00Z`);
  const emitToGuild = jest.fn();

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

  async function contribute(raidId: string, userId: string, xp: number, createdAt: string) {
    await dataSource!.getRepository(RaidParticipation).createQueryBuilder().insert().values({ raidId, userId }).orIgnore().execute();
    await dataSource!.query(
      'INSERT INTO raid_contributions (id, raid_id, user_id, xp_contributed, created_at) VALUES (UUID(), ?, ?, ?, ?)',
      [raidId, userId, xp, createdAt],
    );
    await dataSource!.query('UPDATE raids SET progress_xp = progress_xp + ? WHERE id = ?', [xp, raidId]);
  }

  beforeEach(async () => {
    now = MONDAY_W;
    emitToGuild.mockClear();
    database = await createIntegrationDatabase('wise_raid_fury');
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
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission), repo(MissionRewardItem), repo(CoinBalance), repo(CoinLedgerEntry), EconomyService,
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ProgressionService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToGuild, emitToUser: jest.fn(), syncGuildRoom: jest.fn() } },
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


  const raidOf = (guildId: string) => dataSource!.getRepository(Raid).findOneByOrFail({ guildId });
  const healthOf = async (guildId: string) => {
    const raid = await raidOf(guildId);
    return Math.min(raid.goalXp, Math.max(0, raid.goalXp - raid.progressXp + raid.regeneratedXp));
  };
  const withDamage = (raidId: string, xp: number) => dataSource!.getRepository(Raid).update({ id: raidId }, { progressXp: xp });

  it('gives back RAID_FURY_REGEN_PERCENT of the goal for each whole day without a Dia de estudo', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await withDamage(raid.id, 300);

    await service.runDragonFury(at('06'));

    expect(await raidOf(guildId)).toMatchObject({ goalXp: 1500, regeneratedXp: 75, furyThrough: '2026-10-05' });
    expect(await healthOf(guildId)).toBe(1275);
  });

  it('applies each Raid and day once, however many times the closing runs', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await withDamage((await raidOf(guildId)).id, 300);

    await service.runDragonFury(at('06'));
    await service.runDragonFury(at('06', 20));
    await Promise.all([service.runDragonFury(at('06', 21)), service.runDragonFury(at('06', 22))]);

    expect((await raidOf(guildId)).regeneratedXp).toBe(75);
  });

  it('applies the days missed while the server was down when it comes back', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await withDamage((await raidOf(guildId)).id, 300);

    await service.runDragonFury(at('09'));

    // Friday noon: Monday to Thursday are over.
    expect((await raidOf(guildId)).regeneratedXp).toBe(300);
  });

  it('skips a Dia de estudo and recovers after the guild goes quiet again', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await contribute(raid.id, ana, 300, '2026-10-06 15:00:00.000000');

    // Wednesday is still going and Tuesday was a Dia de estudo: only Monday is owed.
    await service.runDragonFury(at('07'));
    expect((await raidOf(guildId)).regeneratedXp).toBe(75);

    // By Saturday the guild went quiet again: Wednesday, Thursday and Friday are owed too.
    await service.runDragonFury(at('10'));
    expect((await raidOf(guildId)).regeneratedXp).toBe(300);
  });

  it('does not regenerate the partial day in which the Raid opened, nor the last day', async () => {
    now = at('07', 12);
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await withDamage(raid.id, 400);

    await service.runDragonFury(at('08'));
    expect((await raidOf(guildId)).regeneratedXp).toBe(0);

    await service.runDragonFury(at('11'));
    const regenPerDay = Math.floor(raid.goalXp * 0.05);
    expect((await raidOf(guildId)).regeneratedXp).toBe(regenPerDay * 3);
  });

  it('never gives the boss more than full life', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await withDamage(raid.id, 100);

    await service.runDragonFury(at('11'));

    expect((await raidOf(guildId)).regeneratedXp).toBe(100);
    expect(await healthOf(guildId)).toBe(raid.goalXp);
  });

  it('stops when the Meta is batida', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await dataSource!.getRepository(Raid).update({ id: raid.id }, { progressXp: 1500, goalReachedAt: at('05', 20) });

    await service.runDragonFury(at('09'));

    expect((await raidOf(guildId)).regeneratedXp).toBe(0);
  });

  it('announces the new Vida do chefe and the total regenerated to the Guild room, only when it changed', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await withDamage(raid.id, 300);

    await service.runDragonFury(at('06'));
    await service.runDragonFury(at('06', 20));

    expect(emitToGuild.mock.calls.filter(([, event]) => event === 'raid:progress')).toHaveLength(1);
    expect(emitToGuild).toHaveBeenCalledWith(guildId, 'raid:progress', {
      raidId: raid.id,
      progressXp: 300,
      goalXp: 1500,
      goalReachedAt: null,
      regeneratedXp: 75,
      healthXp: 1275,
    });
  });

  it('stays silent when the boss is already at full life', async () => {
    const guildId = await createGuild('Ordem do Foco');

    await service.runDragonFury(at('08'));

    expect(emitToGuild).not.toHaveBeenCalledWith(guildId, 'raid:progress', expect.anything());
  });

  it('makes the Meta batida cost the XP the Fúria gave back, in the Contribuição and in the closing', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await withDamage(raid.id, 1400);
    await service.runDragonFury(at('06'));
    expect((await raidOf(guildId)).regeneratedXp).toBe(75);

    const strike = async (id: string, xp: number, endedAt: Date) => {
      await dataSource!.getRepository(StudySession).insert({
        id, userId: ana, mode: 'guild', raidId: raid.id, state: 'completed', xpAwarded: xp, durationValidSeconds: 600, endedAt,
      });
      await dataSource!.getRepository(RaidParticipation).createQueryBuilder().insert().values({ raidId: raid.id, userId: ana }).orIgnore().execute();
      await service.recordContribution(raid.id, ana, id, xp);
    };
    await strike('00000000-0000-4000-8000-000000000f01', 100, at('06', 13));
    expect((await raidOf(guildId)).goalReachedAt).toBeNull();

    await strike('00000000-0000-4000-8000-000000000f02', 75, at('06', 14));
    expect((await raidOf(guildId)).goalReachedAt).not.toBeNull();
    expect(await service.runWeeklyClose(at('12', 1))).toMatchObject({ closings: [{ status: 'completed' }] });
  });

  it('closes as expired a Raid whose progress only matches the goal because of the Fúria', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await raidOf(guildId);
    await dataSource!.getRepository(Raid).update({ id: raid.id }, { progressXp: 1500, regeneratedXp: 75 });

    expect(await service.runWeeklyClose(at('12', 1))).toMatchObject({ closings: [{ status: 'expired' }] });
  });

  it('exposes the Vida do chefe, the total regenerated and the rule on the active Raid', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await withDamage((await raidOf(guildId)).id, 300);
    now = at('06');
    await service.runDragonFury(now);

    const response = await call('GET', `/guilds/${guildId}/raids/active`);

    expect(await response.json()).toMatchObject({ goalXp: 1500, progressXp: 300, regeneratedXp: 75, healthXp: 1275, furyPercent: 5 });
  });
});
