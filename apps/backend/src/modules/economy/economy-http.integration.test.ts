import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource, type EntityManager } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import type { CoinOriginType } from './domain/coin-origin';
import { EconomyService } from './economy.service';

type StatementPage = {
  items: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    origin: { type: CoinOriginType; ref: string };
    createdAt: string;
  }>;
  nextCursor: string | null;
};

describe('Moeda e Extrato over HTTP against MySQL, with the real AppModule', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let baseUrl: string;
  let ana: { accessToken: string; userId: string };
  let bruno: { accessToken: string; userId: string };

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

  const get = (path: string, token?: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  async function register(email: string, displayName: string): Promise<{ accessToken: string; userId: string }> {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:8081' },
      body: JSON.stringify({ email, password: 'senha-forte-123', displayName }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { accessToken: string };
    const [row] = await dataSource!.query('SELECT id FROM users WHERE email = ?', [email]) as Array<{ id: string }>;
    return { accessToken: body.accessToken, userId: row!.id };
  }

  const economy = () => app!.get(EconomyService);
  const inTransaction = <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => dataSource!.transaction(work);

  beforeAll(async () => {
    database = await createIntegrationDatabase('wise_economy_http');

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

    ana = await register('ana.moedas@example.com', 'Ana');
    bruno = await register('bruno.moedas@example.com', 'Bruno');

    // Ana: 12 from a session, 2 from another, then 5 spent. Each line gets a distinct instant for the paging test.
    await inTransaction((m) => economy().credit(m, ana.userId, 12, { type: 'study-session', ref: 'session-a' }));
    await inTransaction((m) => economy().credit(m, ana.userId, 2, { type: 'study-session', ref: 'session-b' }));
    await inTransaction((m) => economy().debit(m, ana.userId, 5, { type: 'purchase', ref: 'item-1' }));
    for (const [ref, at] of [
      ['session-a', '2026-09-01 10:00:00.100'],
      ['session-b', '2026-09-01 10:05:00.200'],
      ['item-1', '2026-09-01 10:10:00.300'],
    ] as const) {
      await source.query('UPDATE coin_ledger_entries SET created_at = ? WHERE origin_ref = ?', [at, ref]);
    }
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await database?.close();
      } finally {
        for (const [key, value] of Object.entries(previousEnvironment)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      }
    }
  });

  it('requires a bearer token for the balance and the statement', async () => {
    expect((await get('/users/me/coins')).status).toBe(401);
    expect((await get('/users/me/coins/statement')).status).toBe(401);
  });

  it('returns the balance of the authenticated user only', async () => {
    expect(await (await get('/users/me/coins', ana.accessToken)).json()).toEqual({ balance: 9 });
    // Bruno has never received Moedas: no balance row, so the balance is zero.
    expect(await (await get('/users/me/coins', bruno.accessToken)).json()).toEqual({ balance: 0 });
  });

  it('pages the statement newest first, with the origin of every line', async () => {
    const first = await get('/users/me/coins/statement?limit=2', ana.accessToken);
    expect(first.status).toBe(200);
    const firstPage = (await first.json()) as StatementPage;
    expect(firstPage.items).toEqual([
      {
        id: expect.any(String),
        amount: -5,
        balanceAfter: 9,
        origin: { type: 'purchase', ref: 'item-1' },
        createdAt: '2026-09-01T10:10:00.300Z',
      },
      {
        id: expect.any(String),
        amount: 2,
        balanceAfter: 14,
        origin: { type: 'study-session', ref: 'session-b' },
        createdAt: '2026-09-01T10:05:00.200Z',
      },
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const second = (await (await get(
      `/users/me/coins/statement?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
      ana.accessToken,
    )).json()) as StatementPage;
    expect(second.items).toEqual([
      {
        id: expect.any(String),
        amount: 12,
        balanceAfter: 12,
        origin: { type: 'study-session', ref: 'session-a' },
        createdAt: '2026-09-01T10:00:00.100Z',
      },
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('shows another user only their own statement, which is empty for Bruno', async () => {
    expect(await (await get('/users/me/coins/statement', bruno.accessToken)).json()).toEqual({ items: [], nextCursor: null });
  });

  it('rejects invalid pagination parameters with 400', async () => {
    expect((await get('/users/me/coins/statement?limit=51', ana.accessToken)).status).toBe(400);
    expect((await get('/users/me/coins/statement?limit=0', ana.accessToken)).status).toBe(400);
    expect((await get('/users/me/coins/statement?limit=abc', ana.accessToken)).status).toBe(400);
    expect((await get('/users/me/coins/statement?cursor=nope', ana.accessToken)).status).toBe(400);
    expect((await get('/users/me/coins/statement?foo=1', ana.accessToken)).status).toBe(400);
  });
});
