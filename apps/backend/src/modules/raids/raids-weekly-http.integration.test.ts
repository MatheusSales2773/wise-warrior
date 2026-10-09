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
import { RAID_CLOCK } from './raid-clock';
import { GuildRaidsController } from './guild-raids.controller';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

describe('Raid da semana against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  /** Wednesday 2026-10-07 12:00 in São Paulo. */
  let now: Date;

  const ana = '00000000-0000-4000-8000-000000000b01';
  const bruno = '00000000-0000-4000-8000-000000000b02';
  const carla = '00000000-0000-4000-8000-000000000b03';

  const call = (method: string, path: string, as: string | null = ana, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const createGuild = async (name: string, as = ana) => (await (await call('POST', '/guilds', as, { name })).json() as { id: string }).id;

  beforeEach(async () => {
    now = new Date('2026-10-07T15:00:00Z');
    database = await createIntegrationDatabase('wise_raids_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: ana, email: 'ana@example.com', passwordHash: 'hash', displayName: 'Ana', planTier: 'free' },
      { id: bruno, email: 'bruno@example.com', passwordHash: 'hash', displayName: 'Bruno', planTier: 'free' },
      { id: carla, email: 'carla@example.com', passwordHash: 'hash', displayName: 'Carla', planTier: 'free' },
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
        repo(Guild), repo(GuildMembership), repo(Raid), repo(RaidContribution), repo(Mission),
        repo(User), repo(CosmeticItem), repo(UserCosmeticItem),
        { provide: RAID_CLOCK, useValue: () => now },
        { provide: ProgressionService, useValue: {} },
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
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('gives a new Guild the Raid of the current week, with a goal proportional to the days left', async () => {
    const guildId = await createGuild('Ordem do Foco');

    const response = await call('GET', `/guilds/${guildId}/raids/active`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: expect.any(String),
      mission: {
        slug: 'cerco-ao-grimorio',
        name: 'Cerco ao Grimório',
        description: expect.any(String),
        imageUrl: null,
      },
      reward: { itemId: 'c05e71c0-0000-4000-8000-000000000009', name: 'Marcador do Grimório', category: 'badge' },
      goalXp: 1000, // 1.500 × 108h left of 168h = 964.3, up to a multiple of 50
      progressXp: 0,
      startsAt: '2026-10-05T03:00:00.000Z',
      endsAt: '2026-10-12T02:59:59.000Z',
      status: 'active',
    });
  });

  it('gives the full 1.500 XP per member to a Guild created at the start of the week', async () => {
    now = new Date('2026-10-05T03:00:00Z');
    const guildId = await createGuild('Madrugadores');
    const raid = await (await call('GET', `/guilds/${guildId}/raids/active`)).json() as { goalXp: number };
    expect(raid.goalXp).toBe(1500);
  });

  it('rotates the Missão by week, the same for every Guild', async () => {
    const slug = async (guildId: string, as: string) =>
      ((await (await call('GET', `/guilds/${guildId}/raids/active`, as)).json()) as { mission: { slug: string } }).mission.slug;
    const first = await createGuild('Guilda A', ana);
    const second = await createGuild('Guilda B', bruno);
    expect(await slug(first, ana)).toBe('cerco-ao-grimorio');
    expect(await slug(second, bruno)).toBe('cerco-ao-grimorio');

    now = new Date('2026-10-14T15:00:00Z'); // next week
    const third = await createGuild('Guilda C', carla);
    expect(await slug(third, carla)).toBe('marcha-do-silencio');
  });

  it('answers 404 when the Guild has no active Raid, 403 to outsiders and 401 without a session', async () => {
    const guildId = await createGuild('Ordem do Foco');
    expect((await call('GET', `/guilds/${guildId}/raids/active`, bruno)).status).toBe(403);
    expect((await call('GET', `/guilds/${guildId}/raids/active`, null)).status).toBe(401);

    await call('POST', `/guilds/${guildId}/members`, bruno);
    expect((await call('GET', `/guilds/${guildId}/raids/active`, bruno)).status).toBe(200);

    now = new Date('2026-10-12T03:00:00Z'); // the week is over and no job opened the next one yet
    expect((await call('GET', `/guilds/${guildId}/raids/active`)).status).toBe(404);
  });

  it('keeps showing the Raid after its goal is reached', async () => {
    const guildId = await createGuild('Ordem do Foco');
    await dataSource!.getRepository(Raid).update({ guildId }, { progressXp: 1000, status: 'completed' });
    const response = await call('GET', `/guilds/${guildId}/raids/active`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ progressXp: 1000, status: 'completed' });
  });
});
