import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { EconomyService } from '../economy/economy.service';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
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
import { SWORD_ID } from '../../migrations/1788460440000-add-weapon-category';
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
      new EconomyService(
        dataSource.getRepository(CoinBalance),
        dataSource.getRepository(CoinLedgerEntry),
        { emitToUser: () => undefined } as never,
      ),
      { disconnectSessions: () => undefined } as never,
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

  it('gives a new user the three starter items, equipped, and shows the rest of the Catalog locked', async () => {
    await auth.register({ email: 'novata@example.com', password: 'senha-forte-123', displayName: 'Novata' }, {});
    const { id } = await dataSource!.getRepository(User).findOneByOrFail({ email: 'novata@example.com' });

    const response = await getCatalog(id);

    expect(response.status).toBe(200);
    const catalog = await response.json() as CatalogCosmeticItem[];
    expect(summarize(catalog)).toEqual([
      ['Âncora das Brumas', false, false],
      ['Andarilho do Saber', false, false],
      ['Aprendiz', true, true],
      ['Armadura do Lobo', false, false],
      ['Arquimago dos Prazos', false, false],
      ['Besta', false, false],
      ['Brasão da Forja', false, false],
      ['Caçador de Monstros', false, false],
      ['Cajado', false, false],
      ['Capuz do Erudito', true, true],
      ['Cem Sessões', false, false],
      ['Chave da Torre', false, false],
      ['Espada', true, true],
      ['Estudante Crepuscular', false, false],
      ['Guardião das Páginas', false, false],
      ['Lanterna do Silêncio', false, false],
      ['Lanterna do Vigia', false, false],
      ['Madrugador', false, false],
      ['Manto da Vigília', false, false],
      ['Manto Estelar', false, false],
      ['Marcador de Fita', false, false],
      ['Marcador do Grimório', false, false],
      ['Medalhão do Lobo', false, false],
      ['Mestre da Aurora', false, false],
      ['Navegante das Brumas', false, false],
      ['Pena do Escriba', false, false],
      ['Pluma de Grifo', false, false],
      ['Selo dos Madrugadores', false, false],
      ['Sino da Torre', false, false],
      ['Túnica do Viajante', false, false],
    ]);
    expect(catalog).toContainEqual({
      id: 'c05e71c0-0000-4000-8000-000000000008',
      category: 'title',
      name: 'Mestre da Aurora',
      requiresPremium: true,
      unlocked: false,
      equipped: false,
      forSale: false,
      unlockCondition: { type: 'level', level: 15 },
    });
    expect(catalog).toContainEqual(expect.objectContaining({
      name: 'Selo dos Madrugadores',
      category: 'accessory',
      unlockCondition: { type: 'raid', slug: 'vigilia-da-aurora' },
    }));
  });

  it('exposes forSale: true for the item on sale and false for a level item', async () => {
    await auth.register({ email: 'vitrine@example.com', password: 'senha-forte-123', displayName: 'Vitrine' }, {});
    const { id } = await dataSource!.getRepository(User).findOneByOrFail({ email: 'vitrine@example.com' });

    const catalog = await (await getCatalog(id)).json() as CatalogCosmeticItem[];

    expect(catalog.find((item) => item.name === 'Marcador de Fita')).toMatchObject({ unlockCondition: { type: 'purchase' }, forSale: true });
    expect(catalog.find((item) => item.name === 'Aprendiz')).toMatchObject({ unlockCondition: { type: 'level', level: 1 }, forSale: false });
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
      { category: 'weapon', itemId: SWORD_ID, name: 'Espada' },
    ]));
    expect(starter.equipped).toHaveLength(3);

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
    expect(catalog).toHaveLength(30); // the 12 level and Raid items (with the Espada), the 8 items À venda (#174), the 2 Armas À venda (#257) and the 8 Recompensas das Missões à venda (#177)
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
      ['Âncora das Brumas', false, false],
      ['Andarilho do Saber', false, false],
      ['Aprendiz', true, false],
      ['Armadura do Lobo', false, false],
      ['Arquimago dos Prazos', false, false],
      ['Besta', false, false],
      ['Brasão da Forja', false, false],
      ['Caçador de Monstros', false, false],
      ['Cajado', false, false],
      ['Capuz do Erudito', true, false],
      ['Cem Sessões', false, false],
      ['Chave da Torre', false, false],
      ['Espada', true, false],
      ['Estudante Crepuscular', true, false],
      ['Guardião das Páginas', false, false],
      ['Lanterna do Silêncio', false, false],
      ['Lanterna do Vigia', false, false],
      ['Madrugador', false, false],
      ['Manto da Vigília', true, false],
      ['Manto Estelar', false, false],
      ['Marcador de Fita', false, false],
      ['Marcador do Grimório', false, false],
      ['Medalhão do Lobo', false, false],
      ['Mestre da Aurora', false, false],
      ['Navegante das Brumas', false, false],
      ['Pena do Escriba', false, false],
      ['Pluma de Grifo', false, false],
      ['Selo dos Madrugadores', false, false],
      ['Sino da Torre', false, false],
      ['Túnica do Viajante', false, false],
    ]);
    expect(await dataSource!.getRepository(UserCosmeticItem).count({ where: { userId: veteran } })).toBe(5);

    // Tolerating the repeated (user + item) row must not hide other failures, such as an unknown user.
    await expect(dataSource!.transaction((manager) => users.unlockCosmeticItems(
      manager, '00000000-0000-4000-8000-00000000dead', 3,
    ))).rejects.toThrow();
  });
});
