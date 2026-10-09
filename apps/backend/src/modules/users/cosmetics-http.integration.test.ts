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
import { UsersService } from './users.service';

interface CatalogItem {
  id: string;
  category: string;
  name: string;
  requiresPremium: boolean;
  unlocked: boolean;
  equipped: boolean;
  unlockCondition: { type: 'level'; level: number } | { type: 'raid'; slug: string };
}

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

  const summarize = (items: CatalogItem[]) => items.map((item) => [item.name, item.unlocked, item.equipped]);

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_cosmetics_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const config = {
      get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'integration-access-secret' : undefined),
    } as ConfigService;
    auth = new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
    );
    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      new ProgressionService(
        dataSource.getRepository(Character),
        { emitToUser: jest.fn() } as unknown as RealtimeGateway,
      ),
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
    const catalog = await response.json() as CatalogItem[];
    expect(summarize(catalog)).toEqual([
      ['Capuz do Erudito', true, true],
      ['Manto da Vigília', false, false],
      ['Madrugador', false, false],
      ['Cem Sessões', false, false],
      ['Aprendiz', true, true],
      ['Estudante Crepuscular', false, false],
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
      unlockCondition: { type: 'raid', slug: '*' },
    }));
  });

  it('unlocks every item up to the character level without duplicating it when the rule runs again', async () => {
    await dataSource!.getRepository(User).insert({
      id: veteran, email: 'veterano@example.com', passwordHash: 'hash', displayName: 'Veterano', planTier: 'free',
    });
    await dataSource!.getRepository(Character).insert({ userId: veteran, level: 12, xpTotal: 0 });

    for (let run = 0; run < 2; run += 1) {
      await dataSource!.transaction((manager) => users.unlockCosmeticItems(manager, veteran, 12));
    }

    const catalog = await (await getCatalog(veteran)).json() as CatalogItem[];
    expect(summarize(catalog)).toEqual([
      ['Capuz do Erudito', true, false],
      ['Manto da Vigília', true, false],
      ['Madrugador', true, false],
      ['Cem Sessões', true, false],
      ['Aprendiz', true, false],
      ['Estudante Crepuscular', true, false],
      ['Mestre da Aurora', false, false],
      ['Selo dos Madrugadores', false, false],
    ]);
    expect(await dataSource!.getRepository(UserCosmeticItem).count({ where: { userId: veteran } })).toBe(6);
  });
});
