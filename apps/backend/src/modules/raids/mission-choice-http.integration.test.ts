import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import { DataSource, IsNull } from 'typeorm';
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
import { GuildMissionChoiceController } from './guild-mission-choice.controller';
import { GuildRaidsController } from './guild-raids.controller';
import { RaidsController } from './raids.controller';
import { MissionChoiceService } from './mission-choice.service';
import { MissionsService } from './missions.service';
import { GuildMissionChoice } from './entities/guild-mission-choice.entity';
import { UserMission } from './entities/user-mission.entity';
import { RaidsService } from './raids.service';

describe('Escolha da Missão pelo Líder against MySQL', () => {
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
  const carla = '00000000-0000-4000-8000-000000000d03';
  const PRICED_ID = '00000000-0000-4000-8000-0000000000aa';
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

  beforeEach(async () => {
    now = WEDNESDAY_W;
    database = await createIntegrationDatabase('wise_mission_choice');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
      { id: carla, email: 'carla@example.com', passwordHash: 'hash', displayName: 'Carla', planTier: 'free' },
      { id: outsider, email: 'fora@example.com', passwordHash: 'hash', displayName: 'Fora', planTier: 'free' },
    ]);

    await dataSource.query(
      `INSERT INTO missions (id, slug, name, description, image_url, reward_cosmetic_item_id, rotation_order, price)
       SELECT ?, 'ronda-barata', 'Ronda Barata', 'Uma Missão barata.', NULL, reward_cosmetic_item_id, NULL, 90 FROM missions LIMIT 1`,
      [PRICED_ID],
    );

    const repo = (entity: Parameters<DataSource['getRepository']>[0]) => ({
      provide: getRepositoryToken(entity as never),
      useValue: dataSource!.getRepository(entity),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [GuildsController, GuildRaidsController, GuildMissionChoiceController, RaidsController],
      providers: [
        GuildsService,
        RaidsService, MissionsService, MissionChoiceService,
        UsersService,
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(RaidParticipation), repo(Mission), repo(UserMission), repo(GuildMissionChoice),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ProgressionService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn(), emitToUser: jest.fn(), syncGuildRoom: jest.fn() } },
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

  const own = (userId: string) => dataSource!.getRepository(UserMission).insert({ userId, missionId: PRICED_ID });
  const rotationIds = async () => (await dataSource!.getRepository(Mission).find({ where: { price: IsNull() }, order: { rotationOrder: 'ASC' } })).map((m) => m.id);
  const choose = (guildId: string, as: string, body: unknown) => call('PUT', `/guilds/${guildId}/raids/next-mission`, as, body);
  const nextRaid = async (guildId: string) => (await raidsOf(guildId)).at(-1)!;

  async function guildWith(...members: string[]) {
    const guildId = await createGuild('Ordem do Foco');
    for (const member of members) await call('POST', `/guilds/${guildId}/members`, member);
    return guildId;
  }

  it('lists the Missões owned by current members, rotation included, with the owners', async () => {
    const guildId = await guildWith(bruno);
    await own(bruno);

    const response = await call('GET', `/guilds/${guildId}/raids/next-mission/available`, bruno);
    expect(response.status).toBe(200);
    const missions = await response.json() as Array<{ id: string; rotation: boolean; owners: Array<{ userId: string; displayName: string }> }>;
    expect(missions.filter((m) => m.rotation)).toHaveLength((await rotationIds()).length);
    expect(missions.find((m) => m.id === PRICED_ID)).toMatchObject({ rotation: false, owners: [{ userId: bruno, displayName: 'Bruno' }] });
  });

  it('leaves out priced Missões that no current member owns', async () => {
    const guildId = await guildWith(bruno);
    await own(outsider);

    const missions = await (await call('GET', `/guilds/${guildId}/raids/next-mission/available`)).json() as Array<{ id: string }>;
    expect(missions.map((m) => m.id)).not.toContain(PRICED_ID);
  });

  it('refuses non-members on every route and non-Leaders on the choice', async () => {
    const guildId = await guildWith(bruno);

    expect((await call('GET', `/guilds/${guildId}/raids/next-mission/available`, outsider)).status).toBe(403);
    expect((await call('GET', `/guilds/${guildId}/raids/next-mission`, outsider)).status).toBe(403);
    expect((await choose(guildId, outsider, { missionId: (await rotationIds())[0] })).status).toBe(403);
    expect((await choose(guildId, bruno, { missionId: (await rotationIds())[0] })).status).toBe(403);
  });

  it('lets the Leader choose a rotation Missão and every member sees it', async () => {
    const guildId = await guildWith(bruno);
    const [first] = await rotationIds();

    const response = await choose(guildId, ana, { missionId: first });
    expect(response.status).toBe(200);
    const seen = await (await call('GET', `/guilds/${guildId}/raids/next-mission`, bruno)).json() as { choice: { mission: { id: string }; owner: unknown } };
    expect(seen.choice.mission.id).toBe(first);
    expect(seen.choice.owner).toBeNull();
  });

  it('accepts only a priced Missão owned by a current member, naming the owner', async () => {
    const guildId = await guildWith(bruno);
    await own(bruno);

    expect((await choose(guildId, ana, { missionId: PRICED_ID })).status).toBe(422);
    expect((await choose(guildId, ana, { missionId: PRICED_ID, ownerId: ana })).status).toBe(422);
    expect((await choose(guildId, ana, { missionId: PRICED_ID, ownerId: outsider })).status).toBe(422);
    const response = await choose(guildId, ana, { missionId: PRICED_ID, ownerId: bruno });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ choice: { mission: { id: PRICED_ID }, owner: { userId: bruno, displayName: 'Bruno' } } });
  });

  it('lets the Leader change the choice until the Raid starts', async () => {
    const guildId = await guildWith(bruno);
    const [first, second] = await rotationIds();
    await choose(guildId, ana, { missionId: first });
    await choose(guildId, ana, { missionId: second });

    await service.runWeeklyClose(START_W1);

    expect((await nextRaid(guildId)).missionId).toBe(second);
  });

  it('uses the choice on Monday, consumes it, and goes back to the rotation the week after', async () => {
    const guildId = await guildWith(bruno);
    await own(bruno);
    await choose(guildId, ana, { missionId: PRICED_ID, ownerId: bruno });

    await service.runWeeklyClose(START_W1);
    expect((await nextRaid(guildId)).missionId).toBe(PRICED_ID);
    expect((await (await call('GET', `/guilds/${guildId}/raids/next-mission`)).json() as { choice: unknown }).choice).toBeNull();

    await service.runWeeklyClose(JUST_AFTER_W1);
    expect(await rotationIds()).toContain((await nextRaid(guildId)).missionId);
  });

  it('allows repeating the Missão of the current Raid', async () => {
    const guildId = await guildWith(bruno);
    const current = (await nextRaid(guildId)).missionId;
    expect((await choose(guildId, ana, { missionId: current })).status).toBe(200);

    await service.runWeeklyClose(START_W1);

    expect((await nextRaid(guildId)).missionId).toBe(current);
  });

  it('falls back to the rotation when the owner left before the Raid started', async () => {
    const guildId = await guildWith(bruno);
    await own(bruno);
    await choose(guildId, ana, { missionId: PRICED_ID, ownerId: bruno });
    await call('DELETE', `/guilds/${guildId}/members/me`, bruno);

    const current = await (await call('GET', `/guilds/${guildId}/raids/next-mission`)).json() as { choice: unknown };
    expect(current.choice).toBeNull();
    await service.runWeeklyClose(START_W1);

    expect(await rotationIds()).toContain((await nextRaid(guildId)).missionId);
  });

  it('keeps the Raid running when the owner leaves during it', async () => {
    const guildId = await guildWith(bruno);
    await own(bruno);
    await choose(guildId, ana, { missionId: PRICED_ID, ownerId: bruno });
    now = JUST_AFTER_W;
    await service.runWeeklyClose(now);
    await call('DELETE', `/guilds/${guildId}/members/me`, bruno);

    const raid = await (await call('GET', `/guilds/${guildId}/raids/active`)).json() as { status: string };
    expect(raid.status).toBe('active');
    expect((await nextRaid(guildId)).missionId).toBe(PRICED_ID);
  });
});
