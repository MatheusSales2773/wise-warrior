import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { Guild } from '../guilds/entities/guild.entity';
import { GuildMembership } from '../guilds/entities/guild-membership.entity';
import { GuildsService } from '../guilds/guilds.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersService } from '../users/users.service';
import { ProgressionService } from '../progression/progression.service';
import { Mission } from './entities/mission.entity';
import { MissionRewardItem } from './entities/mission-reward-item.entity';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
import { EconomyService } from '../economy/economy.service';
import { Raid } from './entities/raid.entity';
import { RAID_CLOCK, systemRaidClock } from './raid-clock';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidParticipation } from './entities/raid-participation.entity';
import { GuildRaidsController } from './guild-raids.controller';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

type RankingPage = {
  items: Array<{ position: number; userId: string; displayName: string; level: number; title: string | null; contributionXp: number; isMe: boolean; avatar: { itemId: string; name: string } | null; weapon: { itemId: string; name: string } | null; accessory: { itemId: string; name: string } | null }>;
  nextCursor: string | null;
};

describe('Ranking interno of a Raid against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let raidId: string;
  let guildId: string;

  // Ids are ordered so the userId tie-break is predictable: Dani < Eva.
  const ana = '00000000-0000-4000-8000-000000000c01';
  const bruno = '00000000-0000-4000-8000-000000000c02';
  const carla = '00000000-0000-4000-8000-000000000c03';
  const dani = '00000000-0000-4000-8000-000000000c04';
  const eva = '00000000-0000-4000-8000-000000000c05';
  const outsider = '00000000-0000-4000-8000-000000000c09';

  const get = (path: string, as: string | null) => fetch(`${baseUrl}/api/v1${path}`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });
  const ranking = async (as: string, query = '') => (await get(`/raids/${raidId}/ranking${query}`, as)).json() as Promise<RankingPage>;

  async function contribute(userId: string, xp: number, createdAt: string) {
    await dataSource!.query(
      'INSERT INTO raid_contributions (id, raid_id, user_id, xp_contributed, created_at) VALUES (UUID(), ?, ?, ?, ?)',
      [raidId, userId, xp, createdAt],
    );
  }

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_raid_ranking');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert(
      [[ana, 'Ana'], [bruno, 'Bruno'], [carla, 'Carla'], [dani, 'Dani'], [eva, 'Eva'], [outsider, 'Fora']].map(([id, name]) => ({
        id: id!, email: `${name!.toLowerCase()}@example.com`, passwordHash: 'hash', displayName: name!, planTier: 'free',
      })),
    );
    const guild = await dataSource.getRepository(Guild).save(
      dataSource.getRepository(Guild).create({ name: 'Ordem do Foco', createdBy: ana }),
    );
    guildId = guild.id;
    for (const [userId, role] of [[ana, 'leader'], [bruno, 'member'], [carla, 'member'], [dani, 'member'], [eva, 'member']] as const) {
      await dataSource.getRepository(GuildMembership).save(dataSource.getRepository(GuildMembership).create({ guildId, userId, role }));
    }
    const raid = await dataSource.getRepository(Raid).save(
      dataSource.getRepository(Raid).create({
        guildId,
        missionId: (await dataSource.getRepository(Mission).findOneByOrFail({ slug: 'vigilia-da-aurora' })).id,
        goalXp: 1500,
        progressXp: 700,
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() + 86_400_000),
      }),
    );
    raidId = raid.id;
    for (const userId of [ana, bruno, carla, dani, eva]) {
      await dataSource.getRepository(RaidParticipation).insert({ raidId, userId });
    }
    // Ana and Bruno tie on 300 XP: Bruno reached it first. Carla has 100. Dani and Eva only confirmed.
    await contribute(ana, 200, '2026-10-06 10:00:00.000000');
    await contribute(ana, 100, '2026-10-06 12:00:00.000000');
    await contribute(bruno, 300, '2026-10-06 11:00:00.000000');
    await contribute(carla, 100, '2026-10-06 09:00:00.000000');

    const moduleRef = await Test.createTestingModule({
      controllers: [RaidsController, GuildRaidsController],
      providers: [
        RaidsService,
        GuildsService,
        UsersService,
        { provide: RAID_CLOCK, useValue: systemRaidClock },
        { provide: ProgressionService, useValue: {} },
        { provide: getRepositoryToken(Mission), useValue: dataSource.getRepository(Mission) },
        { provide: getRepositoryToken(MissionRewardItem), useValue: dataSource.getRepository(MissionRewardItem) },
        { provide: getRepositoryToken(CoinBalance), useValue: dataSource.getRepository(CoinBalance) },
        { provide: getRepositoryToken(CoinLedgerEntry), useValue: dataSource.getRepository(CoinLedgerEntry) },
        EconomyService,
        { provide: getRepositoryToken(User), useValue: dataSource.getRepository(User) },
        { provide: getRepositoryToken(CosmeticItem), useValue: dataSource.getRepository(CosmeticItem) },
        { provide: getRepositoryToken(UserCosmeticItem), useValue: dataSource.getRepository(UserCosmeticItem) },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn(), emitToUser: jest.fn(), syncGuildRoom: jest.fn() } },
        { provide: getRepositoryToken(Raid), useValue: dataSource.getRepository(Raid) },
        { provide: getRepositoryToken(RaidContribution), useValue: dataSource.getRepository(RaidContribution) },
        { provide: getRepositoryToken(RaidParticipation), useValue: dataSource.getRepository(RaidParticipation) },
        { provide: getRepositoryToken(Guild), useValue: dataSource.getRepository(Guild) },
        { provide: getRepositoryToken(GuildMembership), useValue: dataSource.getRepository(GuildMembership) },
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
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('is restricted to members of the Guild', async () => {
    expect((await get(`/raids/${raidId}/ranking`, null)).status).toBe(401);
    expect((await get(`/raids/${raidId}/ranking`, outsider)).status).toBe(403);
    expect((await get('/raids/00000000-0000-4000-8000-0000000000ff/ranking', ana)).status).toBe(404);
  });

  it('orders by Contribution, then by who reached it first, then userId, with 0 XP Participants last', async () => {
    const page = await ranking(carla);

    expect(page.nextCursor).toBeNull();
    expect(page.items.map((row) => [row.position, row.displayName, row.contributionXp])).toEqual([
      [1, 'Bruno', 300],
      [2, 'Ana', 300],
      [3, 'Carla', 100],
      [4, 'Dani', 0],
      [5, 'Eva', 0],
    ]);
    expect(page.items.filter((row) => row.isMe).map((row) => row.displayName)).toEqual(['Carla']);
  });

  it('carries the level and the equipped Título of each Participant', async () => {
    const [title] = await dataSource!.getRepository(CosmeticItem).find({ where: { category: 'title' }, take: 1 });
    await dataSource!.getRepository(UserCosmeticItem).insert({ userId: ana, cosmeticItemId: title!.id, equipped: true });
    await dataSource!.getRepository(UserCosmeticItem).insert({ userId: bruno, cosmeticItemId: title!.id, equipped: false });
    await dataSource!.query('INSERT INTO characters (id, user_id, level, xp_total) VALUES (UUID(), ?, 7, 0)', [carla]);

    const byName = Object.fromEntries((await ranking(ana)).items.map((row) => [row.displayName, row]));

    expect(byName.Ana).toMatchObject({ title: title!.name, level: 1 });
    expect(byName.Bruno).toMatchObject({ title: null });
    expect(byName.Carla).toMatchObject({ level: 7, title: null });
  });

  it('carries the equipped Avatar, Arma and Acessório of each Participant, read through the Inventory owner', async () => {
    const items = dataSource!.getRepository(CosmeticItem);
    const avatar = await items.findOneByOrFail({ category: 'avatar' });
    const weapon = await items.findOneByOrFail({ category: 'weapon', name: 'Espada' });
    const [accessory, unequipped] = await items.find({ where: { category: 'accessory' }, take: 2 });
    const owned = dataSource!.getRepository(UserCosmeticItem);
    await owned.insert({ userId: ana, cosmeticItemId: avatar.id, equipped: true });
    await owned.insert({ userId: ana, cosmeticItemId: accessory!.id, equipped: true });
    await owned.insert({ userId: ana, cosmeticItemId: weapon.id, equipped: true });
    await owned.insert({ userId: bruno, cosmeticItemId: unequipped!.id, equipped: false });

    const byName = Object.fromEntries((await ranking(carla)).items.map((row) => [row.displayName, row]));

    expect(byName.Ana).toMatchObject({ avatar: { itemId: avatar.id, name: avatar.name }, weapon: { itemId: weapon.id, name: weapon.name }, accessory: { itemId: accessory!.id, name: accessory!.name } });
    expect(byName.Bruno).toMatchObject({ avatar: null, weapon: null, accessory: null });
    expect(byName.Eva).toMatchObject({ avatar: null, weapon: null, accessory: null });
  });

  it('pages without repeating or skipping rows, with dense positions', async () => {
    const first = await ranking(ana, '?limit=2');
    const second = await ranking(ana, `?limit=2&cursor=${first.nextCursor}`);
    const third = await ranking(ana, `?limit=2&cursor=${second.nextCursor}`);

    expect(first.items.map((row) => row.position)).toEqual([1, 2]);
    expect(second.items.map((row) => row.position)).toEqual([3, 4]);
    expect(third.items.map((row) => row.position)).toEqual([5]);
    expect(third.nextCursor).toBeNull();
    expect([...first.items, ...second.items, ...third.items].map((row) => row.displayName)).toEqual(['Bruno', 'Ana', 'Carla', 'Dani', 'Eva']);
  });

  it('rejects an invalid cursor and an out-of-range limit', async () => {
    expect((await get(`/raids/${raidId}/ranking?cursor=nope`, ana)).status).toBe(400);
    expect((await get(`/raids/${raidId}/ranking?limit=51`, ana)).status).toBe(400);
    expect((await get(`/raids/${raidId}/ranking?limit=0`, ana)).status).toBe(400);
  });

  it('drops a former member from the ranking without lowering the collective progress', async () => {
    await dataSource!.getRepository(GuildMembership).delete({ guildId, userId: bruno });

    const page = await ranking(ana);

    expect(page.items.map((row) => [row.position, row.displayName])).toEqual([[1, 'Ana'], [2, 'Carla'], [3, 'Dani'], [4, 'Eva']]);
    expect((await dataSource!.getRepository(Raid).findOneByOrFail({ id: raidId })).progressXp).toBe(700);
  });

  it('counts a Contribution made without a recorded participation', async () => {
    await dataSource!.getRepository(RaidParticipation).delete({ raidId, userId: carla });

    expect((await ranking(ana)).items.map((row) => row.displayName)).toContain('Carla');
  });

  it('puts the first five of the ranking, with their look, in the active Raid and keeps it for members only', async () => {
    const avatar = await dataSource!.getRepository(CosmeticItem).findOneByOrFail({ category: 'avatar' });
    await dataSource!.getRepository(UserCosmeticItem).insert({ userId: bruno, cosmeticItemId: avatar.id, equipped: true });
    const sixth = '00000000-0000-4000-8000-000000000c06';
    await dataSource!.getRepository(User).insert({ id: sixth, email: 'gui@example.com', passwordHash: 'hash', displayName: 'Gui', planTier: 'free' });
    await dataSource!.getRepository(GuildMembership).insert({ guildId, userId: sixth, role: 'member' });
    await dataSource!.getRepository(RaidParticipation).insert({ raidId, userId: sixth });

    const active = await (await get(`/guilds/${guildId}/raids/active`, carla)).json() as { party: RankingPage['items']; rewards: unknown[]; coins: number };

    expect(active.party.map((row) => row.displayName)).toEqual(['Bruno', 'Ana', 'Carla', 'Dani', 'Eva']);
    expect(active.party[0]).toMatchObject({ avatar: { itemId: avatar.id }, weapon: null, accessory: null });
    expect(active.rewards).toHaveLength(1);
    expect(active.coins).toBe(50);
    expect((await get(`/guilds/${guildId}/raids/active`, outsider)).status).toBe(403);
  });

  it('reports the place of the caller in the active Raid, or null before participating', async () => {
    const active = async (as: string) => (await (await get(`/guilds/${guildId}/raids/active`, as)).json()) as { me: { participating: boolean; contributionXp: number; position: number | null } };

    expect((await active(bruno)).me).toEqual({ participating: true, contributionXp: 300, position: 1 });
    expect((await active(eva)).me).toEqual({ participating: true, contributionXp: 0, position: 5 });

    await dataSource!.getRepository(RaidParticipation).delete({ raidId, userId: eva });
    expect((await active(eva)).me).toEqual({ participating: false, contributionXp: 0, position: null });
  });
});
