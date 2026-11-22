import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import {
  AMULETO_DE_BRASA_ID,
  ELMO_DE_ESCAMAS_ID,
  PACOTE_DO_DRAGAO_ID,
  PRESA_DO_DRAGAO_ID,
} from '../../migrations/1788460860000-create-packs';
import { CAJADO_ASTRAL_ID, LENDA_DO_FOCO_ID, MANTO_DO_ARQUIMAGO_ID } from '../../migrations/1788460740000-seed-premium-cosmetic-items';
import { STRIPE_API, type StripeApi } from './stripe.client';

type Account = { accessToken: string; userId: string };
type PackBody = { available: boolean; packs: Array<{ slug: string; owned: boolean; [key: string]: unknown }> };

const MESTRE_DA_AURORA_ID = 'c05e71c0-0000-4000-8000-000000000008';
const PACK_ITEM_IDS = [ELMO_DE_ESCAMAS_ID, PRESA_DO_DRAGAO_ID, AMULETO_DE_BRASA_ID];
const PREMIUM_ITEM_IDS = [MANTO_DO_ARQUIMAGO_ID, CAJADO_ASTRAL_ID, LENDA_DO_FOCO_ID, MESTRE_DA_AURORA_ID];

const ENVIRONMENT: Record<string, string> = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:8081',
  DB_MIGRATIONS_RUN: 'false',
  JWT_ACCESS_SECRET: 'integration-access-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL_DAYS: '30',
  MAX_SESSIONS_PER_USER: '5',
  RATE_LIMIT_CREDENTIALS_LIMIT: '1000',
  RATE_LIMIT_REFRESH_LIMIT: '1000',
};
const BILLING_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PREMIUM', 'APP_URL'];

/**
 * The real AppModule over MySQL. With billing, `STRIPE_SECRET_KEY` holds a placeholder and the Stripe client is a fake
 * that fails on any call: listing the Pacotes never reaches Stripe, and no test calls the network.
 */
function harness(billing: boolean) {
  const state: { database?: IntegrationDatabase; app?: INestApplication; dataSource?: DataSource; baseUrl: string; seq: number } = {
    baseUrl: '',
    seq: 0,
  };
  const previous = Object.fromEntries(
    [...Object.keys(ENVIRONMENT), ...BILLING_KEYS, 'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']
      .map((key) => [key, process.env[key]]),
  );

  beforeAll(async () => {
    state.database = await createIntegrationDatabase(billing ? 'wise_billing_packs' : 'wise_billing_packs_off');
    Object.assign(process.env, ENVIRONMENT, {
      DB_HOST: process.env.TEST_DB_HOST ?? 'localhost',
      DB_PORT: process.env.TEST_DB_PORT ?? '3306',
      DB_USERNAME: process.env.TEST_DB_ADMIN_USERNAME ?? 'root',
      DB_PASSWORD: process.env.TEST_DB_ADMIN_PASSWORD ?? 'change-me-root',
      DB_DATABASE: state.database.name,
    });
    for (const key of BILLING_KEYS) delete process.env[key];
    if (billing) {
      Object.assign(process.env, {
        STRIPE_SECRET_KEY: 'sk_test_placeholder_never_sent',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_placeholder',
        STRIPE_PRICE_PREMIUM: 'price_test_placeholder',
        APP_URL: 'http://localhost:8081',
      });
    }

    let builder = Test.createTestingModule({ imports: [AppModule] });
    if (billing) {
      const unreachable = () => { throw new Error('the Pacote listing must not call Stripe'); };
      const fake: StripeApi = {
        webhooks: { constructEvent: unreachable },
        subscriptions: { retrieve: unreachable, cancel: unreachable },
        customers: { create: unreachable },
        billingPortal: { sessions: { create: unreachable } },
        checkout: { sessions: { create: unreachable, retrieve: unreachable } },
      };
      builder = builder.overrideProvider(STRIPE_API).useValue(fake);
    }
    const moduleRef = await builder.compile();
    state.app = moduleRef.createNestApplication({ logger: false });
    configureApp(state.app);
    await state.app.init();
    const dataSource = state.app.get(DataSource);
    state.dataSource = dataSource;
    await dataSource.runMigrations();
    await state.app.listen(0, '127.0.0.1');
    state.baseUrl = `http://127.0.0.1:${(state.app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    try {
      await state.app?.close();
    } finally {
      try {
        await state.database?.close();
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  const get = (path: string, token?: string): Promise<Response> =>
    fetch(`${state.baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  return {
    get,
    query: (sql: string, parameters: unknown[] = []) => state.dataSource!.query(sql, parameters),
    packs: async (account: Account): Promise<PackBody> => {
      const response = await get('/billing/packs', account.accessToken);
      expect(response.status).toBe(200);
      return (await response.json()) as PackBody;
    },
    pay: (account: Account, packId = PACOTE_DO_DRAGAO_ID) => state.dataSource!.query(
      `INSERT INTO pack_payments (id, user_id, pack_id, stripe_checkout_session_id, amount_cents, currency, paid_at)
       VALUES (UUID(), ?, ?, ?, 490, 'brl', NOW())`,
      [account.userId, packId, `cs_test_${account.userId}_${packId}`],
    ),
    newAccount: async (): Promise<Account> => {
      const email = `pacote${++state.seq}@example.com`;
      const response = await fetch(`${state.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:8081' },
        body: JSON.stringify({ email, password: 'senha-forte-123', displayName: `Comprador ${state.seq}` }),
      });
      expect(response.status).toBe(201);
      const { accessToken } = (await response.json()) as { accessToken: string };
      const [row] = (await state.dataSource!.query('SELECT id FROM users WHERE email = ?', [email])) as Array<{ id: string }>;
      return { accessToken, userId: row!.id };
    },
  };
}

describe('GET /billing/packs with billing configured, over HTTP against MySQL', () => {
  jest.setTimeout(30_000);
  const api = harness(true);

  it('lists the Pacote do Dragão for sale with its price, its 3 items and owned false', async () => {
    const buyer = await api.newAccount();

    expect(await api.packs(buyer)).toEqual({
      available: true,
      packs: [{
        slug: 'dragao',
        name: 'Pacote do Dragão',
        description: 'Elmo, presa e amuleto forjados no fogo de um dragão. Ficam com você para sempre, em qualquer plano.',
        priceCents: 490,
        currency: 'brl',
        items: [
          { id: ELMO_DE_ESCAMAS_ID, name: 'Elmo de Escamas', category: 'avatar' },
          { id: PRESA_DO_DRAGAO_ID, name: 'Presa do Dragão', category: 'weapon' },
          { id: AMULETO_DE_BRASA_ID, name: 'Amuleto de Brasa', category: 'accessory' },
        ],
        owned: false,
      }],
    });
  });

  it('orders the Pacotes for sale by name', async () => {
    const buyer = await api.newAccount();
    await api.query(
      `INSERT INTO packs (id, slug, name, description, price_cents, currency, for_sale) VALUES
        ('pack-zeta', 'aa-zeta', 'Pacote Zeta', 'Z', 990, 'brl', 1),
        ('pack-alfa', 'zz-alfa', 'Pacote Alfa', 'A', 190, 'brl', 1)`,
    );
    try {
      // The slugs sort the other way round, so ordering by slug instead of name fails here.
      expect((await api.packs(buyer)).packs.map((pack) => pack.name)).toEqual(['Pacote Alfa', 'Pacote do Dragão', 'Pacote Zeta']);
    } finally {
      await api.query("DELETE FROM packs WHERE id IN ('pack-zeta', 'pack-alfa')");
    }
  });

  it('marks owned only for the user who paid the Pacote', async () => {
    const payer = await api.newAccount();
    const other = await api.newAccount();
    await api.pay(payer);

    expect((await api.packs(payer)).packs.map(({ slug, owned }) => ({ slug, owned }))).toEqual([{ slug: 'dragao', owned: true }]);
    expect((await api.packs(other)).packs.map(({ slug, owned }) => ({ slug, owned }))).toEqual([{ slug: 'dragao', owned: false }]);
  });

  it('keeps a paid Pacote listed as owned after it leaves the shelf, and hides it from who did not pay', async () => {
    const payer = await api.newAccount();
    const other = await api.newAccount();
    await api.pay(payer);
    await api.query('UPDATE packs SET for_sale = 0 WHERE id = ?', [PACOTE_DO_DRAGAO_ID]);
    try {
      const paid = await api.packs(payer);
      expect(paid.available).toBe(true);
      expect(paid.packs.map(({ slug, owned }) => ({ slug, owned }))).toEqual([{ slug: 'dragao', owned: true }]);
      expect(await api.packs(other)).toEqual({ available: true, packs: [] });
    } finally {
      await api.query('UPDATE packs SET for_sale = 1 WHERE id = ?', [PACOTE_DO_DRAGAO_ID]);
    }
  });

  it('answers 401 without a token', async () => {
    expect((await api.get('/billing/packs')).status).toBe(401);
  });

  it('returns the Pacote items in the Catálogo with the pack condition, locked until the Pacote is paid', async () => {
    const buyer = await api.newAccount();
    type CatalogItem = { id: string; unlockCondition: unknown; requiresPremium: boolean; forSale: boolean; unlocked: boolean };
    const packItems = async () => ((await (await api.get('/users/me/cosmetics', buyer.accessToken)).json()) as CatalogItem[])
      .filter((item) => PACK_ITEM_IDS.includes(item.id))
      .sort((left, right) => left.id.localeCompare(right.id));

    const before = await packItems();
    expect(before).toHaveLength(3);
    for (const item of before) {
      expect(item).toMatchObject({ unlockCondition: { type: 'pack', slug: 'dragao' }, requiresPremium: false, forSale: false, unlocked: false });
    }

    await api.query(
      `INSERT INTO user_cosmetic_items (id, user_id, cosmetic_item_id, equipped) SELECT UUID(), ?, id, 0 FROM cosmetic_items WHERE id IN (?)`,
      [buyer.userId, PACK_ITEM_IDS],
    );
    expect((await packItems()).map((item) => [item.unlocked, item.unlockCondition])).toEqual(
      PACK_ITEM_IDS.map(() => [true, { type: 'pack', slug: 'dragao' }]),
    );
  });

  it('keeps the Pacote items and the Itens premium out of the Loja Itens section, and refuses to put them on sale', async () => {
    const buyer = await api.newAccount();
    const response = await api.get('/shop/items', buyer.accessToken);
    expect(response.status).toBe(200);
    const shelf = ((await response.json()) as Array<{ id: string }>).map((item) => item.id);

    expect(shelf.length).toBeGreaterThan(0);
    for (const id of [...PACK_ITEM_IDS, ...PREMIUM_ITEM_IDS]) expect(shelf).not.toContain(id);
    for (const id of [...PACK_ITEM_IDS, ...PREMIUM_ITEM_IDS]) {
      await expect(api.query('UPDATE cosmetic_items SET price = 100, for_sale = 1 WHERE id = ?', [id]))
        .rejects.toThrow(/CHK_cosmetic_items_for_sale/);
    }
  });
});

describe('GET /billing/packs without STRIPE_SECRET_KEY, over HTTP against MySQL', () => {
  jest.setTimeout(30_000);
  const api = harness(false);

  it('answers 200 with available false and no Pacote, even to a user who paid one', async () => {
    const payer = await api.newAccount();
    await api.pay(payer);

    const response = await api.get('/billing/packs', payer.accessToken);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false, packs: [] });
  });
});
