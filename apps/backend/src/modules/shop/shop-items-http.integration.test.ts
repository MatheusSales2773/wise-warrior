import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';

type ShopItem = { id: string; category: string; name: string; price: number; state: string; missing: number };
type Account = { accessToken: string; userId: string };

const CAPA = 'c05e71c0-0000-4000-8000-0000000005a1';
const LANTERNA = 'c05e71c0-0000-4000-8000-0000000005a2';
const COROA = 'c05e71c0-0000-4000-8000-0000000005a3';
const RAID_ITEM = 'c05e71c0-0000-4000-8000-000000000007'; // seeded: Selo dos Madrugadores, raid:*
const LEVEL_ITEM = 'c05e71c0-0000-4000-8000-000000000003'; // seeded: Madrugador, level:3
const PREMIUM_ITEM = 'c05e71c0-0000-4000-8000-000000000008'; // seeded: Mestre da Aurora, premium
const NOT_FOR_SALE = 'c05e71c0-0000-4000-8000-0000000005a4'; // purchase condition, but not for sale

describe('Loja: Compra de Cosmetic Items À venda over HTTP against MySQL, with the real AppModule', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let baseUrl: string;
  let seq = 0;

  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_MIGRATIONS_RUN: process.env.DB_MIGRATIONS_RUN,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL_DAYS: process.env.JWT_REFRESH_TTL_DAYS,
    MAX_SESSIONS_PER_USER: process.env.MAX_SESSIONS_PER_USER,
    RATE_LIMIT_CREDENTIALS_LIMIT: process.env.RATE_LIMIT_CREDENTIALS_LIMIT,
    RATE_LIMIT_REFRESH_LIMIT: process.env.RATE_LIMIT_REFRESH_LIMIT,
  };

  const request = (method: string, path: string, token?: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const listItems = async (account: Account): Promise<ShopItem[]> =>
    (await (await request('GET', '/shop/items', account.accessToken)).json()) as ShopItem[];
  const purchase = (account: Account, itemId: string) => request('POST', `/shop/items/${itemId}/purchase`, account.accessToken);
  const balanceOf = async (account: Account): Promise<number> =>
    ((await (await request('GET', '/users/me/coins', account.accessToken)).json()) as { balance: number }).balance;
  const inventoryOf = async (account: Account): Promise<string[]> =>
    ((await (await request('GET', '/users/me/cosmetics', account.accessToken)).json()) as Array<{ id: string; unlocked: boolean }>)
      .filter((item) => item.unlocked).map((item) => item.id);

  async function newAccount(coins: number): Promise<Account> {
    const email = `comprador${++seq}@example.com`;
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:8081' },
      body: JSON.stringify({ email, password: 'senha-forte-123', displayName: `Comprador ${seq}` }),
    });
    expect(response.status).toBe(201);
    const { accessToken } = (await response.json()) as { accessToken: string };
    const [row] = await dataSource!.query('SELECT id FROM users WHERE email = ?', [email]) as Array<{ id: string }>;
    const account = { accessToken, userId: row!.id };
    // Signup already granted the welcome Moedas; set the balance the test needs.
    await dataSource!.query('UPDATE coin_balances SET balance = ? WHERE user_id = ?', [coins, account.userId]);
    return account;
  }

  beforeAll(async () => {
    database = await createIntegrationDatabase('wise_shop_http');

    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:8081';
    process.env.DB_HOST = process.env.TEST_DB_HOST ?? 'localhost';
    process.env.DB_PORT = process.env.TEST_DB_PORT ?? '3306';
    process.env.DB_USERNAME = process.env.TEST_DB_ADMIN_USERNAME ?? 'root';
    process.env.DB_PASSWORD = process.env.TEST_DB_ADMIN_PASSWORD ?? 'change-me-root';
    process.env.DB_DATABASE = database.name;
    process.env.DB_MIGRATIONS_RUN = 'false';
    process.env.JWT_ACCESS_SECRET = 'integration-access-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL_DAYS = '30';
    process.env.MAX_SESSIONS_PER_USER = '5';
    process.env.RATE_LIMIT_CREDENTIALS_LIMIT = '1000';
    process.env.RATE_LIMIT_REFRESH_LIMIT = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    const source = app.get(DataSource);
    dataSource = source;
    await source.runMigrations();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;

    await source.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale) VALUES
        (?, 'avatar', 'Capa de Estrelas', 'purchase', 0, 120, 1),
        (?, 'accessory', 'Lanterna do Estudo', 'purchase', 0, 30, 1),
        (?, 'title', 'Coroa de Louros', 'purchase', 0, 300, 1),
        (?, 'badge', 'Selo Guardado', 'purchase', 0, NULL, 0)`,
      [CAPA, LANTERNA, COROA, NOT_FOR_SALE],
    );
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await database?.close();
      } finally {
        for (const [key, value] of Object.entries(previousEnvironment)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  it('requires a bearer token', async () => {
    expect((await request('GET', '/shop/items')).status).toBe(401);
    expect((await request('POST', `/shop/items/${CAPA}/purchase`)).status).toBe(401);
  });

  it('lists only the items À venda, with price and the state for the user', async () => {
    const account = await newAccount(100);
    const items = await listItems(account);
    expect(items.map((item) => [item.name, item.price, item.state, item.missing]).sort()).toEqual([
      ['Capa de Estrelas', 120, 'insufficient', 20],
      ['Coroa de Louros', 300, 'insufficient', 200],
      ['Lanterna do Estudo', 30, 'purchasable', 0],
      // The seeded catalog (#174).
      ['Marcador de Fita', 30, 'purchasable', 0],
      ['Guardião das Páginas', 45, 'purchasable', 0],
      ['Pena do Escriba', 60, 'purchasable', 0],
      ['Andarilho do Saber', 90, 'purchasable', 0],
      ['Túnica do Viajante', 120, 'insufficient', 20],
      ['Lanterna do Vigia', 180, 'insufficient', 80],
      ['Arquimago dos Prazos', 240, 'insufficient', 140],
      ['Manto Estelar', 300, 'insufficient', 200],
    ].sort());
    expect(items.find((item) => item.id === CAPA)).toMatchObject({ category: 'avatar' });
  });

  it('does not offer the Recompensas das Missões à venda in the item shop', async () => {
    const account = await newAccount(1000);
    const names = (await listItems(account)).map((item) => item.name);
    for (const reward of ['Pluma de Grifo', 'Sino da Torre', 'Chave da Torre', 'Âncora das Brumas', 'Navegante das Brumas', 'Medalhão do Lobo', 'Caçador de Monstros', 'Armadura do Lobo']) {
      expect(names).not.toContain(reward);
    }
  });

  it('debits the price and puts the item in the Inventário, ready to Equipar', async () => {
    const account = await newAccount(150);
    const response = await purchase(account, CAPA);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ itemId: CAPA, price: 120, balance: 30 });

    expect(await balanceOf(account)).toBe(30);
    expect(await inventoryOf(account)).toContain(CAPA);
    expect((await request('PATCH', `/users/me/cosmetics/${CAPA}`, account.accessToken)).status).toBe(204);

    const statement = (await (await request('GET', '/users/me/coins/statement', account.accessToken)).json()) as {
      items: Array<{ amount: number; origin: { type: string; ref: string } }>;
    };
    expect(statement.items[0]).toMatchObject({ amount: -120, origin: { type: 'purchase' } });
    expect((await listItems(account)).find((item) => item.id === CAPA)).toMatchObject({ state: 'owned', missing: 0 });
  });

  it('refuses an item the user already owns with 409 and keeps the balance', async () => {
    const account = await newAccount(300);
    expect((await purchase(account, LANTERNA)).status).toBe(201);
    const again = await purchase(account, LANTERNA);
    expect(again.status).toBe(409);
    expect(await balanceOf(account)).toBe(270);
  });

  it('refuses a purchase without enough Moedas with 422, saying how many are missing', async () => {
    const account = await newAccount(100);
    const response = await purchase(account, CAPA);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ status: 422, missing: 20 });
    expect(await balanceOf(account)).toBe(100);
    expect(await inventoryOf(account)).not.toContain(CAPA);
  });

  it.each([
    ['a Recompensa de Raid', RAID_ITEM],
    ['a level item', LEVEL_ITEM],
    ['an Item premium', PREMIUM_ITEM],
    ['an item not marked À venda', NOT_FOR_SALE],
    ['an unknown item', 'c05e71c0-0000-4000-8000-ffffffffffff'],
  ])('refuses %s without charging', async (_label, itemId) => {
    const account = await newAccount(300);
    expect((await purchase(account, itemId)).status).toBe(404);
    expect(await balanceOf(account)).toBe(300);
  });

  it('never lets the database mark a Recompensa de Raid, level item or Item premium À venda', async () => {
    for (const id of [RAID_ITEM, LEVEL_ITEM, PREMIUM_ITEM]) {
      await expect(dataSource!.query('UPDATE cosmetic_items SET for_sale = 1, price = 100 WHERE id = ?', [id])).rejects.toThrow();
    }
  });

  it('enforces the À venda rule on every write path, not only on save()', async () => {
    const items = dataSource!.getRepository(CosmeticItem);
    const draft = { category: 'accessory' as const, name: 'Rascunho', requiresPremium: false, forSale: true };

    // save() trips the entity hook with a readable message.
    await expect(items.save(items.create({ ...draft, unlockCondition: 'raid:*', price: 100 }))).rejects.toThrow(/Condição de desbloqueio de compra/);
    // insert(), update() and the query builder skip the hook; the CHECK still refuses them.
    // A Badge is never À venda, whichever write path tries it.
    await expect(items.save(items.create({ ...draft, category: 'badge', unlockCondition: 'purchase', price: 100 }))).rejects.toThrow(/Badge nunca/);
    await expect(items.insert({ ...draft, category: 'badge', unlockCondition: 'purchase', price: 100 })).rejects.toThrow();
    await expect(items.insert({ ...draft, unlockCondition: 'level:3', price: 100 })).rejects.toThrow();
    await expect(items.insert({ ...draft, unlockCondition: 'purchase', price: 301 })).rejects.toThrow();
    await expect(items.update({ id: RAID_ITEM }, { forSale: true, price: 100 })).rejects.toThrow();
    await expect(items.update({ id: PREMIUM_ITEM }, { unlockCondition: 'purchase', forSale: true, price: 100 })).rejects.toThrow();
    await expect(items.createQueryBuilder().update().set({ forSale: true, price: 100 }).where('id = :id', { id: LEVEL_ITEM }).execute()).rejects.toThrow();
  });

  it('charges once when the same item is bought twice at the same time', async () => {
    const account = await newAccount(500);
    const statuses = (await Promise.all([purchase(account, CAPA), purchase(account, CAPA)])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await balanceOf(account)).toBe(380);
  });

  it('never leaves the balance negative when two purchases together exceed it', async () => {
    const account = await newAccount(140); // 120 + 30 > 140
    const before = (await inventoryOf(account)).length;
    const statuses = (await Promise.all([purchase(account, CAPA), purchase(account, LANTERNA)])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 422]);
    expect([20, 110]).toContain(await balanceOf(account));
    expect(await inventoryOf(account)).toHaveLength(before + 1);
  });
});
