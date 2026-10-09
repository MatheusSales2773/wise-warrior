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
import { Raid } from './entities/raid.entity';
import { RAID_CLOCK, systemRaidClock } from './raid-clock';
import { RaidContribution } from './entities/raid-contribution.entity';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

describe('Raids HTTP access control against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let raidId: string;

  const ana = '00000000-0000-4000-8000-000000000b01';
  const bruno = '00000000-0000-4000-8000-000000000b02';
  const missingRaid = '00000000-0000-4000-8000-0000000000ff';

  const get = (path: string, as: string | null) => fetch(`${baseUrl}/api/v1${path}`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_raids_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
    ]);
    const guild = await dataSource.getRepository(Guild).save(
      dataSource.getRepository(Guild).create({ name: 'Ordem do Foco', createdBy: ana }),
    );
    await dataSource.getRepository(GuildMembership).save(
      dataSource.getRepository(GuildMembership).create({ guildId: guild.id, userId: ana, role: 'leader' }),
    );
    const raid = await dataSource.getRepository(Raid).save(
      dataSource.getRepository(Raid).create({
        guildId: guild.id,
        missionId: (await dataSource.getRepository(Mission).findOneByOrFail({ slug: 'vigilia-da-aurora' })).id,
        goalXp: 1500,
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() + 86_400_000),
      }),
    );
    raidId = raid.id;

    const moduleRef = await Test.createTestingModule({
      controllers: [RaidsController],
      providers: [
        RaidsService,
        GuildsService,
        UsersService,
        { provide: RAID_CLOCK, useValue: systemRaidClock },
        { provide: ProgressionService, useValue: {} },
        { provide: getRepositoryToken(Mission), useValue: dataSource.getRepository(Mission) },
        { provide: getRepositoryToken(User), useValue: dataSource.getRepository(User) },
        { provide: getRepositoryToken(CosmeticItem), useValue: dataSource.getRepository(CosmeticItem) },
        { provide: getRepositoryToken(UserCosmeticItem), useValue: dataSource.getRepository(UserCosmeticItem) },
        { provide: RealtimeGateway, useValue: { emitToGuild: jest.fn() } },
        { provide: getRepositoryToken(Raid), useValue: dataSource.getRepository(Raid) },
        { provide: getRepositoryToken(RaidContribution), useValue: dataSource.getRepository(RaidContribution) },
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

  it('requires authentication', async () => {
    expect((await get(`/raids/${raidId}`, null)).status).toBe(401);
    expect((await get(`/raids/${raidId}/ranking`, null)).status).toBe(401);
  });

  it('shows the raid detail and ranking to guild members', async () => {
    const detail = await get(`/raids/${raidId}`, ana);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: raidId, goalXp: 1500 });
    const ranking = await get(`/raids/${raidId}/ranking`, ana);
    expect(ranking.status).toBe(200);
    expect(await ranking.json()).toEqual([]);
  });

  it('answers 403 to an authenticated user outside the guild', async () => {
    expect((await get(`/raids/${raidId}`, bruno)).status).toBe(403);
    expect((await get(`/raids/${raidId}/ranking`, bruno)).status).toBe(403);
  });

  it('answers 404 for a missing raid', async () => {
    expect((await get(`/raids/${missingRaid}`, ana)).status).toBe(404);
    expect((await get(`/raids/${missingRaid}/ranking`, ana)).status).toBe(404);
  });
});
