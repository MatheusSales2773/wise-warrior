import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { RaidsService } from '../raids/raids.service';

const REWARD_ITEM_ID = 'c05e71c0-0000-4000-8000-000000000007';
const CHEAP_ID = 'a1550000-0000-4000-8000-0000000000a1';
const DEAR_ID = 'a1550000-0000-4000-8000-0000000000a2';
const ROTATION_ID = 'a1550000-0000-4000-8000-000000000001';

type StoreMission = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  reward: { id: string; name: string; category: string };
  state: 'owned' | 'purchasable' | 'insufficient';
  missing: number;
};

describe('Loja: Compra de Missões over HTTP against MySQL, with the real AppModule', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let baseUrl: string;
  let counter = 0;

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
    RATE_LIMIT_SHOP_LIMIT: process.env.RATE_LIMIT_SHOP_LIMIT,
  };

  const call = (method: string, path: string, token?: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });

  async function register(label: string, coins: number): Promise<{ accessToken: string; userId: string }> {
    const email = `${label}.${(counter += 1)}@loja.example.com`;
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:8081' },
      body: JSON.stringify({ email, password: 'senha-forte-123', displayName: label }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { accessToken: string };
    const [row] = (await dataSource!.query('SELECT id FROM users WHERE email = ?', [email])) as Array<{ id: string }>;
    const userId = row!.id;
    // Registration already grants the welcome Moedas (#165); pin the balance so each test starts from a known amount.
    await dataSource!.query('UPDATE coin_balances SET balance = ? WHERE user_id = ?', [coins, userId]);
    return { accessToken: body.accessToken, userId };
  }

  const balanceOf = async (token: string): Promise<number> =>
    ((await (await call('GET', '/users/me/coins', token)).json()) as { balance: number }).balance;
  const ownedCount = async (userId: string): Promise<number> =>
    Number(((await dataSource!.query('SELECT COUNT(*) AS n FROM user_missions WHERE user_id = ?', [userId])) as Array<{ n: string }>)[0]!.n);

  beforeAll(async () => {
    database = await createIntegrationDatabase('wise_shop_missions_http');

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
    process.env.RATE_LIMIT_SHOP_LIMIT = '5';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    const source = app.get(DataSource);
    dataSource = source;
    await source.runMigrations();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;

    // The art-backed catalogue arrives later; the tests carry their own priced Missões (outside the rotation).
    await source.query(
      `INSERT INTO missions (id, slug, name, description, image_url, reward_cosmetic_item_id, rotation_order, price)
       VALUES (?, 'ronda-barata', 'Ronda Barata', 'Uma Missão barata.', NULL, ?, NULL, 90),
              (?, 'cerco-caro', 'Cerco Caro', 'Uma Missão cara.', NULL, ?, NULL, 480)`,
      [CHEAP_ID, REWARD_ITEM_ID, DEAR_ID, REWARD_ITEM_ID],
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
    expect((await call('GET', '/shop/missions')).status).toBe(401);
    expect((await call('POST', `/shop/missions/${CHEAP_ID}/purchase`)).status).toBe(401);
  });

  it('lists only priced Missões, with price, reward and the state for the user', async () => {
    const user = await register('lista', 100);
    const response = await call('GET', '/shop/missions', user.accessToken);
    expect(response.status).toBe(200);
    const missions = (await response.json()) as StoreMission[];
    expect(missions.map((m) => m.id)).toEqual([CHEAP_ID, DEAR_ID]);
    expect(missions.find((m) => m.id === ROTATION_ID)).toBeUndefined();
    expect(missions[0]).toEqual({
      id: CHEAP_ID,
      slug: 'ronda-barata',
      name: 'Ronda Barata',
      description: 'Uma Missão barata.',
      imageUrl: null,
      price: 90,
      reward: { id: REWARD_ITEM_ID, name: expect.any(String), category: expect.any(String) },
      state: 'purchasable',
      missing: 0,
    });
    expect(missions[1]).toMatchObject({ id: DEAR_ID, price: 480, state: 'insufficient', missing: 380 });
  });

  it('buys a Missão: debits the price, records the ownership and keeps it', async () => {
    const user = await register('compra', 100);
    const response = await call('POST', `/shop/missions/${CHEAP_ID}/purchase`, user.accessToken);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ missionId: CHEAP_ID, price: 90, balance: 10 });

    expect(await balanceOf(user.accessToken)).toBe(10);
    expect(await ownedCount(user.userId)).toBe(1);
    const statement = (await (await call('GET', '/users/me/coins/statement', user.accessToken)).json()) as {
      items: Array<{ amount: number; origin: { type: string; ref: string } }>;
    };
    expect(statement.items[0]).toMatchObject({ amount: -90, origin: { type: 'purchase', ref: `mission:${CHEAP_ID}` } });

    const missions = (await (await call('GET', '/shop/missions', user.accessToken)).json()) as StoreMission[];
    expect(missions.find((m) => m.id === CHEAP_ID)).toMatchObject({ state: 'owned', missing: 0 });
  });

  it('answers 409 for a Missão already owned, without debiting again', async () => {
    const user = await register('repetida', 300);
    expect((await call('POST', `/shop/missions/${CHEAP_ID}/purchase`, user.accessToken)).status).toBe(201);
    const again = await call('POST', `/shop/missions/${CHEAP_ID}/purchase`, user.accessToken);
    expect(again.status).toBe(409);
    expect(await balanceOf(user.accessToken)).toBe(210);
    expect(await ownedCount(user.userId)).toBe(1);
  });

  it('answers 422 with the missing amount when the balance is short, leaving balance and ownership untouched', async () => {
    const user = await register('pobre', 100);
    const response = await call('POST', `/shop/missions/${DEAR_ID}/purchase`, user.accessToken);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ status: 422, missing: 380 });
    expect(await balanceOf(user.accessToken)).toBe(100);
    expect(await ownedCount(user.userId)).toBe(0);
  });

  it('keeps the rotation Missões out of the Loja: they are free and cannot be bought', async () => {
    const user = await register('rodizio', 500);
    expect((await call('POST', `/shop/missions/${ROTATION_ID}/purchase`, user.accessToken)).status).toBe(404);
    expect((await call('POST', '/shop/missions/a1550000-0000-4000-8000-0000000000ff/purchase', user.accessToken)).status).toBe(404);
    expect(await balanceOf(user.accessToken)).toBe(500);
  });

  it('rate limits the Compra per user, with a 429 and Retry-After', async () => {
    const user = await register('limite', 0);
    const other = await register('vizinho', 0);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await call('POST', `/shop/missions/${DEAR_ID}/purchase`, user.accessToken)).status).toBe(422);
    }
    const blocked = await call('POST', `/shop/missions/${DEAR_ID}/purchase`, user.accessToken);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    // The counter is per user: someone else on the same network is not blocked, and reading is not limited.
    expect((await call('POST', `/shop/missions/${DEAR_ID}/purchase`, other.accessToken)).status).toBe(422);
    expect((await call('GET', '/shop/missions', user.accessToken)).status).toBe(200);
  });

  it('keeps priced Missões out of the weekly rotation', async () => {
    const owner = await register('rotacao', 0);
    const guildId = '5a1d0000-0000-4000-8000-000000000001';
    await dataSource!.query('INSERT INTO guilds (id, name, created_by) VALUES (?, ?, ?)', [guildId, 'Guilda da Rotação', owner.userId]);
    const raid = await dataSource!.transaction((manager) => app!.get(RaidsService).createForGuild(manager, guildId, 1, new Date()));
    expect([CHEAP_ID, DEAR_ID]).not.toContain(raid.missionId);
  });

  it('never leaves the balance negative when two Compras race on the same balance', async () => {
    const user = await register('corrida', 100);
    const results = await Promise.all([
      call('POST', `/shop/missions/${CHEAP_ID}/purchase`, user.accessToken),
      call('POST', `/shop/missions/${DEAR_ID}/purchase`, user.accessToken),
      call('POST', `/shop/missions/${CHEAP_ID}/purchase`, user.accessToken),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(await balanceOf(user.accessToken)).toBe(10);
    expect(await ownedCount(user.userId)).toBe(1);
  });
});
