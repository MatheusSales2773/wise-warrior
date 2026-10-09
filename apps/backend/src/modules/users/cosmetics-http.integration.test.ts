import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/entities/session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { User } from './entities/user.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { UsersController } from './users.controller';
import { UsersService, type CatalogCosmeticItem } from './users.service';

describe('Cosmetics Catalog HTTP contract against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let auth: AuthService;
  let users: UsersService;
  let baseUrl: string;

  const veteran = '00000000-0000-4000-8000-000000000b01';

  const getCatalog = (as: string | null) => fetch(`${baseUrl}/api/v1/users/me/cosmetics`, {
    headers: as === null ? {} : { authorization: 'Bearer integration-token', 'x-test-user-id': as },
  });

  /** The UI owns the display order, so the contract is compared by name. */
  const summarize = (items: CatalogCosmeticItem[]) => items
    .map((item) => [item.name, item.unlocked, item.equipped])
    .sort(([a], [b]) => String(a).localeCompare(String(b), 'pt-BR'));

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_cosmetics_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const config = {
      get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'integration-access-secret' : undefined),
    } as ConfigService;
    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService, // replaced below, once progression exists
    );
    const progression = new ProgressionService(
      dataSource.getRepository(Character),
      { emitToUser: jest.fn() } as unknown as RealtimeGateway,
      users,
    );
    Object.assign(users, { progression });
    auth = new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
      users,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
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
    expect((await getCatalog(null)).status).toBe(401);
  });

  it('gives a new user both starter items, equipped, and shows the rest of the Catalog locked', async () => {
    await auth.register({ email: 'novata@example.com', password: 'senha-forte-123', displayName: 'Novata' }, {});
    const { id } = await dataSource!.getRepository(User).findOneByOrFail({ email: 'novata@example.com' });

    const response = await getCatalog(id);

    expect(response.status).toBe(200);
    const catalog = await response.json() as CatalogCosmeticItem[];
    expect(summarize(catalog)).toEqual([
      ['Aprendiz', true, true],
      ['Brasão da Forja', false, false],
      ['Capuz do Erudito', true, true],
      ['Cem Sessões', false, false],
      ['Estudante Crepuscular', false, false],
      ['Lanterna do Silêncio', false, false],
      ['Madrugador', false, false],
      ['Manto da Vigília', false, false],
      ['Marcador do Grimório', false, false],
      ['Mestre da Aurora', false, false],
      ['Selo dos Madrugadores', false, false],
    ]);
    expect(catalog).toContainEqual({
      id: 'c05e71c0-0000-4000-8000-000000000008',
      category: 'title',
      name: 'Mestre da Aurora',
      requiresPremium: true,
      unlocked: false,
      equipped: false,
      unlockCondition: { type: 'level', level: 15 },
    });
    expect(catalog).toContainEqual(expect.objectContaining({
      name: 'Selo dos Madrugadores',
      category: 'accessory',
      unlockCondition: { type: 'raid', slug: 'vigilia-da-aurora' },
    }));
  });

  it('derives the profile Título and equipment from the equipped Cosmetic Items', async () => {
    await auth.register({ email: 'titular@example.com', password: 'senha-forte-123', displayName: 'Titular' }, {});
    const { id } = await dataSource!.getRepository(User).findOneByOrFail({ email: 'titular@example.com' });
    const getProfile = async () => {
      const response = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { authorization: 'Bearer integration-token', 'x-test-user-id': id },
      });
      expect(response.status).toBe(200);
      return response.json() as Promise<{ title: string | null; equipped: unknown[] }>;
    };

    const starter = await getProfile();
    expect(starter.title).toBe('Aprendiz');
    expect(starter.equipped).toEqual(expect.arrayContaining([
      { category: 'avatar', itemId: 'c05e71c0-0000-4000-8000-000000000001', name: 'Capuz do Erudito' },
      { category: 'title', itemId: 'c05e71c0-0000-4000-8000-000000000002', name: 'Aprendiz' },
    ]));
    expect(starter.equipped).toHaveLength(2);

    await dataSource!.transaction((manager) => users.unlockCosmeticItems(manager, id, 5));
    expect((await fetch(`${baseUrl}/api/v1/users/me/cosmetics/c05e71c0-0000-4000-8000-000000000004`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer integration-token', 'x-test-user-id': id },
    })).status).toBe(204);
    expect((await getProfile()).title).toBe('Estudante Crepuscular');

    await dataSource!.getRepository(UserCosmeticItem).update({ userId: id }, { equipped: false });
    expect(await getProfile()).toEqual(expect.objectContaining({ title: null, equipped: [] }));
  });

  it('leaves an item with a malformed unlock condition out of the Catalog instead of failing it', async () => {
    await dataSource!.getRepository(User).insert({
      id: veteran, email: 'veterano@example.com', passwordHash: 'hash', displayName: 'Veterano', planTier: 'free',
    });
    await dataSource!.getRepository(CosmeticItem).insert({
      category: 'badge', name: 'Quebrado', unlockCondition: 'achievement:x', requiresPremium: false,
    });

    const response = await getCatalog(veteran);

    expect(response.status).toBe(200);
    const catalog = await response.json() as CatalogCosmeticItem[];
    expect(catalog).toHaveLength(11);
    expect(catalog.map((item) => item.name)).not.toContain('Quebrado');
  });

  it('unlocks every item up to the character level without duplicating it when the rule runs again', async () => {
    await dataSource!.getRepository(User).insert({
      id: veteran, email: 'veterano@example.com', passwordHash: 'hash', displayName: 'Veterano', planTier: 'free',
    });
    await dataSource!.getRepository(Character).insert({ userId: veteran, level: 12, xpTotal: 0 });

    for (let run = 0; run < 2; run += 1) {
      await dataSource!.transaction((manager) => users.unlockCosmeticItems(manager, veteran, 12));
    }

    const catalog = await (await getCatalog(veteran)).json() as CatalogCosmeticItem[];
    expect(summarize(catalog)).toEqual([
      ['Aprendiz', true, false],
      ['Brasão da Forja', false, false],
      ['Capuz do Erudito', true, false],
      ['Cem Sessões', true, false],
      ['Estudante Crepuscular', true, false],
      ['Lanterna do Silêncio', false, false],
      ['Madrugador', true, false],
      ['Manto da Vigília', true, false],
      ['Marcador do Grimório', false, false],
      ['Mestre da Aurora', false, false],
      ['Selo dos Madrugadores', false, false],
    ]);
    expect(await dataSource!.getRepository(UserCosmeticItem).count({ where: { userId: veteran } })).toBe(6);

    // Tolerating the repeated (user + item) row must not hide other failures, such as an unknown user.
    await expect(dataSource!.transaction((manager) => users.unlockCosmeticItems(
      manager, '00000000-0000-4000-8000-00000000dead', 3,
    ))).rejects.toThrow();
  });
});
