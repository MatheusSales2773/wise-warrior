import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ProgressionService } from '../progression/progression.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { User } from './entities/user.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const ITEM = (n: number) => `c05e71c0-0000-4000-8000-00000000000${n}`;
const APRENDIZ = ITEM(2);
const CREPUSCULAR = ITEM(4);
const MESTRE_DA_AURORA = ITEM(8);
const SELO = ITEM(7);

describe('Equipping Cosmetic Items against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let premiumForAll = 'true';

  const free = '00000000-0000-4000-8000-000000000c01';
  const stranger = '00000000-0000-4000-8000-000000000c02';

  const call = (method: 'PATCH' | 'DELETE', userId: string, itemId: string) => fetch(
    `${baseUrl}/api/v1/users/me/cosmetics/${itemId}${method === 'DELETE' ? '/equipped' : ''}`,
    { method, headers: { authorization: 'Bearer integration-token', 'x-test-user-id': userId } },
  );
  const equip = (userId: string, itemId: string) => call('PATCH', userId, itemId);
  const unequip = (userId: string, itemId: string) => call('DELETE', userId, itemId);

  const equippedNames = async (userId: string) => (await dataSource!.getRepository(UserCosmeticItem).find({
    where: { userId, equipped: true },
    relations: ['cosmeticItem'],
  })).map((row) => row.cosmeticItem.name).sort();

  const seedUser = async (id: string, level: number, planTier: 'free' | 'premium' = 'free') => {
    await dataSource!.getRepository(User).insert({
      id, email: `${id}@example.com`, passwordHash: 'hash', displayName: 'Aluno', planTier,
    });
    await dataSource!.transaction(async (manager) => {
      await users.grantStarterInventory(manager, id);
      await users.unlockCosmeticItems(manager, id, level);
    });
  };

  let users: UsersService;

  beforeEach(async () => {
    premiumForAll = 'true';
    database = await createIntegrationDatabase('wise_cosmetics_equip');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const config = { get: (key: string) => (key === 'COSMETICS_PREMIUM_FOR_ALL' ? premiumForAll : undefined) } as ConfigService;
    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService,
      config,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: {} },
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

  it('swaps the equipped item of a category when another one is equipped', async () => {
    await seedUser(free, 5);

    expect((await equip(free, CREPUSCULAR)).status).toBe(204);

    expect(await equippedNames(free)).toEqual(['Capuz do Erudito', 'Estudante Crepuscular']);
  });

  it('ends with exactly one item equipped per category when equips race in the same category', async () => {
    await seedUser(free, 8);
    const avatars = [ITEM(1), ITEM(5)] as const;

    for (let round = 0; round < 5; round += 1) {
      const responses = await Promise.all([
        equip(free, CREPUSCULAR), equip(free, APRENDIZ), equip(free, CREPUSCULAR), equip(free, APRENDIZ),
        equip(free, avatars[round % 2]!), equip(free, avatars[(round + 1) % 2]!),
      ]);
      expect(responses.map((response) => response.status)).toEqual(Array(6).fill(204));

      const rows = await dataSource!.getRepository(UserCosmeticItem).find({
        where: { userId: free, equipped: true },
        relations: ['cosmeticItem'],
      });
      const perCategory = rows.map((row) => row.cosmeticItem.category).sort();
      expect(perCategory).toEqual(['avatar', 'title']);
    }
  });

  it('refuses to equip an item that is not in the Inventory', async () => {
    await seedUser(free, 1);

    expect((await equip(free, CREPUSCULAR)).status).toBe(404);
    expect((await equip(free, SELO)).status).toBe(404);
    expect(await equippedNames(free)).toEqual(['Aprendiz', 'Capuz do Erudito']);
  });

  it('lets a free user equip a premium item while the MVP policy releases it to everyone', async () => {
    await seedUser(free, 15);

    expect((await equip(free, MESTRE_DA_AURORA)).status).toBe(204);

    expect(await equippedNames(free)).toEqual(['Capuz do Erudito', 'Mestre da Aurora']);
  });

  it('answers 403 to a free user on a premium item once the policy flag is off, and keeps the equipment', async () => {
    premiumForAll = 'false';
    await seedUser(free, 15);

    expect((await equip(free, MESTRE_DA_AURORA)).status).toBe(403);

    expect(await equippedNames(free)).toEqual(['Aprendiz', 'Capuz do Erudito']);
  });

  it('still lets a premium user equip a premium item with the policy flag off', async () => {
    premiumForAll = 'false';
    await seedUser(free, 15, 'premium');

    expect((await equip(free, MESTRE_DA_AURORA)).status).toBe(204);
  });

  it('unequips any category, including Avatar and Título, and is idempotent', async () => {
    await seedUser(free, 1);

    expect((await unequip(free, APRENDIZ)).status).toBe(204);
    expect(await equippedNames(free)).toEqual(['Capuz do Erudito']);
    expect((await unequip(free, APRENDIZ)).status).toBe(204);
    expect((await unequip(free, ITEM(1))).status).toBe(204);
    expect(await equippedNames(free)).toEqual([]);
  });

  it('answers 404 when unequipping an item outside the Inventory, or one owned by someone else', async () => {
    await seedUser(free, 1);
    await seedUser(stranger, 5);

    expect((await unequip(free, CREPUSCULAR)).status).toBe(404);
    expect((await unequip(free, '00000000-0000-4000-8000-0000000000ff')).status).toBe(404);
    expect(await equippedNames(stranger)).toEqual(['Aprendiz', 'Capuz do Erudito']);
  });
});
