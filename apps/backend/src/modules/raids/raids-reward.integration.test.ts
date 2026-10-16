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
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UsersController } from '../users/users.controller';
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

type CatalogItem = { id: string; name: string; unlocked: boolean; equipped: boolean };

describe('Recompensa de Raid against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let service: RaidsService;
  let baseUrl: string;
  let now: Date;
  let emitToUser: jest.Mock;

  // The Guild is created on Wednesday of week W, whose Missão is "Cerco ao Grimório".
  const WEDNESDAY_W = new Date('2026-10-07T15:00:00Z');
  const JUST_AFTER_W = new Date('2026-10-12T03:00:30Z');
  const CERCO_REWARD = 'c05e71c0-0000-4000-8000-000000000009';
  const CERCO_EXTRA_REWARD = 'c05e71c0-0000-4000-8000-0000000000f9';

  const ana = '00000000-0000-4000-8000-000000000e01';
  const bruno = '00000000-0000-4000-8000-000000000e02';
  const carla = '00000000-0000-4000-8000-000000000e03';
  const dani = '00000000-0000-4000-8000-000000000e04';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const createGuild = async (name: string, as = ana) => (await (await call('POST', '/guilds', as, { name })).json() as { id: string }).id;
  const currentRaid = async (guildId: string) => dataSource!.getRepository(Raid).findOneByOrFail({ guildId, status: 'active' });
  const reward = async (as: string) => ((await (await call('GET', '/users/me/cosmetics', as)).json()) as CatalogItem[])
    .find((item) => item.id === CERCO_REWARD)!;
  const coinBalance = async (userId: string) => (await dataSource!.getRepository(CoinBalance).findOneBy({ userId }))?.balance ?? 0;
  const raidWinEntries = (userId: string) => dataSource!.getRepository(CoinLedgerEntry).find({ where: { userId, originType: 'raid-win' } });
  const ownedItems = async (userId: string) => (await dataSource!.getRepository(UserCosmeticItem).find({ where: { userId } }))
    .map(({ cosmeticItemId }) => cosmeticItemId);
  /** A Missão passa a dar dois itens: o do seed e mais este. */
  const addSecondRewardItem = async () => {
    await dataSource!.query(
      "INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium) VALUES (?, 'badge', 'Selo do Cerco', 'raid:cerco-ao-grimorio', 0)",
      [CERCO_EXTRA_REWARD],
    );
    await dataSource!.getRepository(MissionRewardItem).insert({
      missionId: (await dataSource!.getRepository(Mission).findOneByOrFail({ slug: 'cerco-ao-grimorio' })).id,
      cosmeticItemId: CERCO_EXTRA_REWARD,
    });
  };
  const owned = (userId: string) => dataSource!.getRepository(UserCosmeticItem).count({ where: { userId, cosmeticItemId: CERCO_REWARD } });

  async function participate(raidId: string, userId: string) {
    await dataSource!.getRepository(RaidParticipation).createQueryBuilder().insert().values({ raidId, userId }).orIgnore().execute();
  }

  async function contribute(raidId: string, userId: string, xp: number) {
    await participate(raidId, userId);
    await dataSource!.query(
      'INSERT INTO raid_contributions (id, raid_id, user_id, xp_contributed, created_at) VALUES (UUID(), ?, ?, ?, ?)',
      [raidId, userId, xp, '2026-10-08 12:00:00.000000'],
    );
    await dataSource!.query('UPDATE raids SET progress_xp = progress_xp + ? WHERE id = ?', [xp, raidId]);
  }

  const reachGoal = (raidId: string) => dataSource!.getRepository(Raid).update({ id: raidId }, { goalReachedAt: new Date('2026-10-09T12:00:00Z'), progressXp: 99_999 });

  beforeEach(async () => {
    now = WEDNESDAY_W;
    emitToUser = jest.fn();
    database = await createIntegrationDatabase('wise_raid_reward');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert(
      [[ana, 'Ana'], [bruno, 'Bruno'], [carla, 'Carla'], [dani, 'Dani']].map(([id, name]) => ({
        id: id!, email: `${name!.toLowerCase()}@example.com`, passwordHash: 'hash', displayName: name!, planTier: 'free',
      })),
    );

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, RaidsController, UsersController],
      providers: [
        GuildsService,
        RaidsService,
        UsersService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission), repo(MissionRewardItem), repo(CoinBalance), repo(CoinLedgerEntry), EconomyService,
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ProgressionService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn(), emitToUser, syncGuildRoom: jest.fn() } },
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

  it('gives the Missão item to the members who contributed, and to nobody else, without equipping it', async () => {
    const guildId = await createGuild('Ordem do Foco');
    for (const member of [bruno, carla, dani]) await call('POST', `/guilds/${guildId}/members`, member);
    const raid = await currentRaid(guildId);
    await contribute(raid.id, ana, 300);
    await participate(raid.id, bruno); // confirmed, never contributed
    await contribute(raid.id, carla, 100);
    await call('DELETE', `/guilds/${guildId}/members/me`, carla); // contributed, then left
    await reachGoal(raid.id);
    expect((await reward(ana)).unlocked).toBe(false);

    const { closings } = await service.runWeeklyClose(JUST_AFTER_W);

    expect(closings).toEqual([
      expect.objectContaining({ raidId: raid.id, status: 'completed', rewardedUserIds: [ana], rewardItemIds: [CERCO_REWARD] }),
    ]);
    expect(await reward(ana)).toMatchObject({ name: 'Marcador do Grimório', unlocked: true, equipped: false });
    expect((await reward(bruno)).unlocked).toBe(false);
    expect((await reward(carla)).unlocked).toBe(false);
    expect((await reward(dani)).unlocked).toBe(false);
  });

  it('gives nothing when the Raid closes expired', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await contribute((await currentRaid(guildId)).id, ana, 100);

    const { closings } = await service.runWeeklyClose(JUST_AFTER_W);

    expect(closings).toEqual([expect.objectContaining({ status: 'expired', rewardedUserIds: [], rewardItemIds: [] })]);
    expect((await reward(ana)).unlocked).toBe(false);
  });

  it('does not duplicate the item when the closing runs again', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const raid = await currentRaid(guildId);
    await contribute(raid.id, ana, 300);
    await reachGoal(raid.id);

    await service.runWeeklyClose(JUST_AFTER_W);
    await service.runWeeklyClose(JUST_AFTER_W);

    expect(await owned(ana)).toBe(1);
  });

  it('does not duplicate nor re-equip the item when the same Missão is won again', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const first = await currentRaid(guildId);
    await contribute(first.id, ana, 300);
    await reachGoal(first.id);
    await service.runWeeklyClose(JUST_AFTER_W);
    await call('PATCH', `/users/me/cosmetics/${CERCO_REWARD}`, ana);
    expect(await reward(ana)).toMatchObject({ unlocked: true, equipped: true });

    // An older, still active Raid of the same Missão (e.g. from before a downtime) is won as well.
    const again = await dataSource!.getRepository(Raid).save(dataSource!.getRepository(Raid).create({
      guildId,
      missionId: first.missionId,
      goalXp: 50,
      startsAt: new Date('2026-09-28T03:00:00Z'),
      endsAt: new Date('2026-10-05T02:59:59Z'),
    }));
    await contribute(again.id, ana, 100);
    await reachGoal(again.id);

    const { closings } = await service.runWeeklyClose(JUST_AFTER_W);

    expect(closings).toEqual([expect.objectContaining({ raidId: again.id, rewardedUserIds: [ana] })]);
    expect(await owned(ana)).toBe(1);
    expect(await reward(ana)).toMatchObject({ unlocked: true, equipped: true });
  });

  it('gives every item of the Missão, skipping the ones the member already owns', async () => {
    await addSecondRewardItem();
    const guildId = await createGuild('Ordem do Foco');
    await call('POST', `/guilds/${guildId}/members`, bruno);
    const raid = await currentRaid(guildId);
    await contribute(raid.id, ana, 300);
    await contribute(raid.id, bruno, 100);
    await dataSource!.getRepository(UserCosmeticItem).insert({ userId: bruno, cosmeticItemId: CERCO_EXTRA_REWARD, equipped: true });
    await reachGoal(raid.id);

    const { closings } = await service.runWeeklyClose(JUST_AFTER_W);

    expect(closings[0]!.rewardItemIds.slice().sort()).toEqual([CERCO_REWARD, CERCO_EXTRA_REWARD]);
    for (const member of [ana, bruno]) {
      const items = await ownedItems(member);
      expect(items).toEqual(expect.arrayContaining([CERCO_REWARD, CERCO_EXTRA_REWARD]));
      expect(items.filter((id) => id === CERCO_EXTRA_REWARD)).toHaveLength(1);
    }
    // The item Bruno already had keeps its state.
    expect(await dataSource!.getRepository(UserCosmeticItem).findOneByOrFail({ userId: bruno, cosmeticItemId: CERCO_EXTRA_REWARD }))
      .toMatchObject({ equipped: true });
  });

  it('credits 50 Moedas to each member with Contribution, via the raid-win origin, and to nobody else', async () => {
    const guildId = await createGuild('Ordem do Foco');
    for (const member of [bruno, carla, dani]) await call('POST', `/guilds/${guildId}/members`, member);
    const raid = await currentRaid(guildId);
    await contribute(raid.id, ana, 300);
    await participate(raid.id, bruno); // confirmed, never contributed
    await contribute(raid.id, carla, 100);
    await call('DELETE', `/guilds/${guildId}/members/me`, carla); // contributed, then left
    await reachGoal(raid.id);
    const balance = await coinBalance(ana);

    await service.runWeeklyClose(JUST_AFTER_W);

    expect(await coinBalance(ana)).toBe(balance + 50);
    expect(await raidWinEntries(ana)).toEqual([expect.objectContaining({ amount: 50, originRef: raid.id })]);
    for (const member of [bruno, carla, dani]) expect(await raidWinEntries(member)).toEqual([]);
    expect(emitToUser).toHaveBeenCalledWith(ana, 'coins:changed', expect.objectContaining({ delta: 50 }));
  });

  it('credits no Moedas when the Raid closes expired', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await contribute((await currentRaid(guildId)).id, ana, 100);

    await service.runWeeklyClose(JUST_AFTER_W);

    expect(await raidWinEntries(ana)).toEqual([]);
  });

  it('credits the Moedas once when the closing runs again, and again when the same Missão is won again', async () => {
    const guildId = await createGuild('Ordem do Foco');
    const first = await currentRaid(guildId);
    await contribute(first.id, ana, 300);
    await reachGoal(first.id);
    await service.runWeeklyClose(JUST_AFTER_W);
    await service.runWeeklyClose(JUST_AFTER_W);
    expect(await raidWinEntries(ana)).toHaveLength(1);

    const again = await dataSource!.getRepository(Raid).save(dataSource!.getRepository(Raid).create({
      guildId,
      missionId: first.missionId,
      goalXp: 50,
      startsAt: new Date('2026-09-28T03:00:00Z'),
      endsAt: new Date('2026-10-05T02:59:59Z'),
    }));
    await contribute(again.id, ana, 100);
    await reachGoal(again.id);
    await service.runWeeklyClose(JUST_AFTER_W);

    expect((await raidWinEntries(ana)).map(({ originRef }) => originRef).sort()).toEqual([first.id, again.id].sort());
    expect(await owned(ana)).toBe(1);
  });
});
