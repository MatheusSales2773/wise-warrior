import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { APP_CREATE_OPTIONS } from '../../app.setup';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { ProgressionService } from '../progression/progression.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersService } from '../users/users.service';
import { SWORD_ID as ESPADA } from '../../migrations/1788460440000-add-weapon-category';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Pack } from './entities/pack.entity';
import { PackPayment } from './entities/pack-payment.entity';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

const ITEM = (n: number) => `c05e71c0-0000-4000-8000-00000000000${n}`;
const CAPUZ = ITEM(1);
const APRENDIZ = ITEM(2);
const MESTRE_DA_AURORA = ITEM(8);
/** Itens premium e de Pacote só deste teste, em categorias que o seed não ocupa com Item premium. */
const CAJADO = 'c05e71c0-0000-4000-8000-0000000009a1';
const AMULETO_PREMIUM = 'c05e71c0-0000-4000-8000-0000000009a2';
const ELMO_DE_PACOTE = 'c05e71c0-0000-4000-8000-0000000009a3';

const WEBHOOK_SECRET = 'test-webhook-signing-secret';
const OTHER_SECRET = 'another-signing-secret';
const CUSTOMER = 'cus_test_1';
const SUBSCRIPTION = 'sub_test_1';
const PERIOD_END = 1798675200; // 2026-12-31T00:00:00Z
const CANCEL_AT = 1798675200;

describe('Stripe webhook against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let users: UsersService;

  // The real SDK, only for its offline signature code: no key reaches Stripe and no test calls the network.
  const signer = new Stripe('test-key-that-never-reaches-the-network');
  const retrieve = jest.fn<Promise<Stripe.Subscription>, [string]>();
  const emitted: Array<{ userId: string; event: string; payload: unknown; planTierWhenEmitted: Promise<string> }> = [];
  const realtime = {
    emitToUser: jest.fn((userId: string, event: string, payload: unknown) => {
      emitted.push({
        userId,
        event,
        payload,
        planTierWhenEmitted: dataSource!.query('SELECT plan_tier FROM users WHERE id = ?', [userId])
          .then((rows: Array<{ plan_tier: string }>) => rows[0]!.plan_tier),
      });
    }),
  };

  const user = '00000000-0000-4000-8000-0000000000b1';
  const stripeSubscription = (options: {
    id?: string; status: string; cancelAt?: number | null; periodEnd?: number;
  }): Stripe.Subscription => ({
    id: options.id ?? SUBSCRIPTION,
    object: 'subscription',
    customer: CUSTOMER,
    status: options.status,
    cancel_at: options.cancelAt ?? null,
    items: { data: [{ current_period_end: options.periodEnd ?? PERIOD_END }] },
  }) as unknown as Stripe.Subscription;

  const eventBody = (type: string, object: Record<string, unknown>, id = `evt_${emitted.length}_${type}`) =>
    JSON.stringify({ id, object: 'event', type, data: { object } });
  const subscriptionEvent = (type: string, payloadStatus = 'active', subscriptionId = SUBSCRIPTION, customer = CUSTOMER) =>
    eventBody(type, { id: subscriptionId, object: 'subscription', customer, status: payloadStatus, cancel_at: null });

  const post = (body: string, headers: Record<string, string> = {}) => fetch(`${baseUrl}/api/v1/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
  const signed = (body: string, secret = WEBHOOK_SECRET) => post(body, {
    'stripe-signature': signer.webhooks.generateTestHeaderString({ payload: body, secret }),
  });

  const row = () => dataSource!.getRepository(Subscription).findOneByOrFail({ userId: user });
  const planTier = async () => (await dataSource!.getRepository(User).findOneByOrFail({ id: user })).planTier;
  const equippedIds = async () => (await dataSource!.getRepository(UserCosmeticItem).find({ where: { userId: user, equipped: true } }))
    .map((inventory) => inventory.cosmeticItemId).sort();
  const eventsNamed = (event: string) => emitted.filter((entry) => entry.event === event);

  const seedPremiumUser = async (equip: string[]) => {
    await dataSource!.getRepository(User).insert({
      id: user, email: 'premium@example.com', passwordHash: 'hash', displayName: 'Aluno', planTier: 'premium',
    });
    await dataSource!.transaction(async (manager) => {
      await users.grantStarterInventory(manager, user);
      await users.unlockCosmeticItems(manager, user, 15);
    });
    await dataSource!.getRepository(CosmeticItem).insert([
      { id: CAJADO, category: 'weapon', name: 'Cajado Astral', unlockCondition: 'level:1', requiresPremium: true },
      { id: AMULETO_PREMIUM, category: 'accessory', name: 'Amuleto Premium', unlockCondition: 'level:1', requiresPremium: true },
      { id: ELMO_DE_PACOTE, category: 'avatar', name: 'Elmo de Escamas', unlockCondition: 'pack:dragao', requiresPremium: false },
    ]);
    await dataSource!.getRepository(UserCosmeticItem).insert(
      [CAJADO, AMULETO_PREMIUM, ELMO_DE_PACOTE].map((cosmeticItemId) => ({ userId: user, cosmeticItemId, equipped: false })),
    );
    const inventory = dataSource!.getRepository(UserCosmeticItem);
    // One equipped item per category: the starter of each category is replaced by the item the test equips.
    for (const itemId of equip) {
      const category = (await dataSource!.getRepository(CosmeticItem).findOneByOrFail({ id: itemId })).category;
      const sameCategory = await inventory.find({ where: { userId: user, cosmeticItem: { category } } });
      await inventory.update(sameCategory.map((entry) => entry.id), { equipped: false });
      await inventory.update({ userId: user, cosmeticItemId: itemId }, { equipped: true });
    }
    await dataSource!.getRepository(Subscription).insert({
      userId: user, stripeCustomerId: CUSTOMER, stripeSubscriptionId: SUBSCRIPTION, status: 'active',
      currentPeriodEnd: new Date(1790000000 * 1000), cancelAt: null,
    });
  };

  const seedFreeUser = async () => {
    await dataSource!.getRepository(User).insert({
      id: user, email: 'free@example.com', passwordHash: 'hash', displayName: 'Aluno', planTier: 'free',
    });
    await dataSource!.getRepository(Subscription).insert({ userId: user, stripeCustomerId: CUSTOMER, status: null });
  };

  beforeEach(async () => {
    emitted.length = 0;
    realtime.emitToUser.mockClear();
    retrieve.mockReset();
    database = await createIntegrationDatabase('wise_billing_webhook');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService,
      undefined,
      realtime as unknown as RealtimeGateway,
    );
    const stripeApi: StripeApi = { webhooks: signer.webhooks, subscriptions: { retrieve } };
    const config = { get: (key: string) => (key === 'STRIPE_WEBHOOK_SECRET' ? WEBHOOK_SECRET : undefined) } as ConfigService;

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: STRIPE_API, useValue: stripeApi },
        { provide: ConfigService, useValue: config },
        { provide: UsersService, useValue: users },
        { provide: RealtimeGateway, useValue: realtime },
        { provide: getRepositoryToken(Subscription), useValue: dataSource.getRepository(Subscription) },
        { provide: getRepositoryToken(Pack), useValue: dataSource.getRepository(Pack) },
        { provide: getRepositoryToken(PackPayment), useValue: dataSource.getRepository(PackPayment) },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    app = moduleRef.createNestApplication(APP_CREATE_OPTIONS);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useLogger(false);
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  describe('signature', () => {
    it('answers 400 and touches nothing when the Stripe-Signature header is missing', async () => {
      await seedPremiumUser([]);
      const before = await row();

      const response = await post(subscriptionEvent('customer.subscription.deleted', 'canceled'));

      expect(response.status).toBe(400);
      expect(retrieve).not.toHaveBeenCalled();
      expect(await row()).toEqual(before);
      expect(await planTier()).toBe('premium');
      expect(emitted).toEqual([]);
    });

    it('answers 400 and touches nothing when the signature was made with another secret', async () => {
      await seedPremiumUser([]);
      const before = await row();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      const response = await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'), OTHER_SECRET);

      expect(response.status).toBe(400);
      expect(retrieve).not.toHaveBeenCalled();
      expect(await row()).toEqual(before);
      expect(await planTier()).toBe('premium');
      expect(emitted).toEqual([]);
    });

    it('answers 400 when the body was changed after it was signed', async () => {
      await seedPremiumUser([]);
      const original = subscriptionEvent('customer.subscription.deleted', 'canceled');
      const header = signer.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET });

      const response = await post(original.replace('canceled', 'active'), { 'stripe-signature': header });

      expect(response.status).toBe(400);
      expect(retrieve).not.toHaveBeenCalled();
    });
  });

  describe('events it does not handle', () => {
    it.each(['customer.subscription.trial_will_end', 'invoice.created', 'payment_intent.succeeded'])(
      'answers 200 and writes nothing for %s',
      async (type) => {
        await seedPremiumUser([]);
        const before = await row();

        const response = await signed(subscriptionEvent(type, 'canceled'));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true });
        expect(retrieve).not.toHaveBeenCalled();
        expect(await row()).toEqual(before);
        expect(await planTier()).toBe('premium');
        expect(emitted).toEqual([]);
      },
    );
  });

  describe('Customer without a Subscription row', () => {
    it('answers 200, writes nothing and logs the event id', async () => {
      await seedPremiumUser([]);
      const before = await row();
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      const response = await signed(
        subscriptionEvent('customer.subscription.deleted', 'canceled', SUBSCRIPTION, 'cus_unknown'),
      );

      expect(response.status).toBe(200);
      expect(retrieve).not.toHaveBeenCalled();
      expect(await dataSource!.getRepository(Subscription).count()).toBe(1);
      expect(await row()).toEqual(before);
      expect(await planTier()).toBe('premium');
      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`evt_${emitted.length}_customer.subscription.deleted`));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cus_unknown'));
    });
  });

  describe('what is written comes from the Stripe API, not from the payload', () => {
    it('writes canceled and turns the plan free when the payload says active and the API says canceled', async () => {
      await seedPremiumUser([]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled', cancelAt: null, periodEnd: PERIOD_END }));

      const response = await signed(subscriptionEvent('customer.subscription.updated', 'active'));

      expect(response.status).toBe(200);
      expect(retrieve).toHaveBeenCalledWith(SUBSCRIPTION);
      const stored = await row();
      expect(stored.status).toBe('canceled');
      expect(stored.currentPeriodEnd).toEqual(new Date(PERIOD_END * 1000));
      expect(stored.cancelAt).toBeNull();
      expect(await planTier()).toBe('free');
    });

    it('stores current_period_end from the Subscription item and cancel_at from the API', async () => {
      await seedFreeUser();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'active', cancelAt: CANCEL_AT, periodEnd: PERIOD_END + 86400 }));

      await signed(subscriptionEvent('customer.subscription.updated', 'incomplete'));

      const stored = await row();
      expect(stored.stripeSubscriptionId).toBe(SUBSCRIPTION);
      expect(stored.status).toBe('active');
      expect(stored.currentPeriodEnd).toEqual(new Date((PERIOD_END + 86400) * 1000));
      expect(stored.cancelAt).toEqual(new Date(CANCEL_AT * 1000));
    });

    it('rereads the Subscription for an invoice event and for a subscription Checkout Session', async () => {
      await seedFreeUser();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'active' }));

      const invoice = await signed(eventBody('invoice.paid', {
        object: 'invoice', customer: CUSTOMER, parent: { subscription_details: { subscription: SUBSCRIPTION } },
      }, 'evt_invoice'));
      expect(invoice.status).toBe(200);
      expect(await planTier()).toBe('premium');

      await dataSource!.getRepository(User).update({ id: user }, { planTier: 'free' });
      await dataSource!.getRepository(Subscription).update({ userId: user }, { status: null, stripeSubscriptionId: null });
      const checkout = await signed(eventBody('checkout.session.completed', {
        object: 'checkout.session', mode: 'subscription', customer: CUSTOMER, subscription: SUBSCRIPTION,
      }, 'evt_checkout'));
      expect(checkout.status).toBe(200);
      expect(await planTier()).toBe('premium');
      expect((await row()).stripeSubscriptionId).toBe(SUBSCRIPTION);
    });
  });

  describe('plan_tier from the Stripe status', () => {
    it.each([
      ['active', 'premium'], ['trialing', 'premium'], ['past_due', 'premium'],
      ['canceled', 'free'], ['unpaid', 'free'], ['incomplete', 'free'], ['incomplete_expired', 'free'], ['paused', 'free'],
    ] as const)('status %s leaves the plan %s', async (status, expected) => {
      if (expected === 'premium') await seedFreeUser(); else await seedPremiumUser([]);
      retrieve.mockResolvedValue(stripeSubscription({ status }));

      expect((await signed(subscriptionEvent('customer.subscription.updated', status))).status).toBe(200);

      expect(await planTier()).toBe(expected);
      expect((await row()).status).toBe(status);
    });

    it('keeps premium for an active Subscription that ends in the future (cancel_at set)', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'active', cancelAt: CANCEL_AT }));

      await signed(subscriptionEvent('customer.subscription.updated'));

      expect(await planTier()).toBe('premium');
      expect((await row()).cancelAt).toEqual(new Date(CANCEL_AT * 1000));
      expect(await equippedIds()).toContain(MESTRE_DA_AURORA);
      expect(emitted).toEqual([]);
    });
  });

  describe('user:planChanged', () => {
    it('is emitted once, to the user, with the new plan and only after the commit', async () => {
      await seedFreeUser();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'active' }));

      await signed(subscriptionEvent('customer.subscription.created'));

      const changes = eventsNamed('user:planChanged');
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ userId: user, payload: { planTier: 'premium' } });
      // The listener read the database at the moment of the emit, through its own connection: the commit had landed.
      expect(await changes[0]!.planTierWhenEmitted).toBe('premium');
    });

    it('is not emitted when the plan stays the same', async () => {
      await seedPremiumUser([]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'past_due' }));

      await signed(eventBody('invoice.payment_failed', {
        object: 'invoice', customer: CUSTOMER, parent: { subscription_details: { subscription: SUBSCRIPTION } },
      }));

      expect(eventsNamed('user:planChanged')).toEqual([]);
      expect((await row()).status).toBe('past_due');
    });
  });

  describe('when the plan turns free', () => {
    it('puts the Título back to Aprendiz, empties a category with no Item inicial, restores the Item inicial of Arma and keeps a Pacote item', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA, CAJADO, AMULETO_PREMIUM, ELMO_DE_PACOTE]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      expect((await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'))).status).toBe(200);

      expect(await planTier()).toBe('free');
      expect(await equippedIds()).toEqual([APRENDIZ, ELMO_DE_PACOTE, ESPADA].sort());
      expect(eventsNamed('character:equipmentChanged').map((entry) => entry.payload)).toEqual(expect.arrayContaining([
        { category: 'title', cosmeticItemId: APRENDIZ },
        { category: 'weapon', cosmeticItemId: ESPADA },
        { category: 'accessory', cosmeticItemId: null },
      ]));
      expect(eventsNamed('character:equipmentChanged')).toHaveLength(3);
      expect(eventsNamed('user:planChanged')).toHaveLength(1);
    });

    it('keeps the Pacote item equipped and emits no equipment change when only a Pacote item was equipped', async () => {
      await seedPremiumUser([ELMO_DE_PACOTE]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'));

      expect(await equippedIds()).toContain(ELMO_DE_PACOTE);
      expect(await equippedIds()).not.toContain(CAPUZ);
      expect(eventsNamed('character:equipmentChanged')).toEqual([]);
      expect(eventsNamed('user:planChanged')).toHaveLength(1);
    });

    it('leaves the Inventário untouched: the premium items stay owned, only unequipped', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA, CAJADO]);
      const owned = async () => (await dataSource!.getRepository(UserCosmeticItem).find({ where: { userId: user } }))
        .map((entry) => entry.cosmeticItemId).sort();
      const ownedBefore = await owned();
      expect(ownedBefore).toEqual(expect.arrayContaining([MESTRE_DA_AURORA, CAJADO, AMULETO_PREMIUM, CAPUZ]));
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'));

      expect(await planTier()).toBe('free');
      expect(await owned()).toEqual(ownedBefore);
      expect(await equippedIds()).not.toEqual(expect.arrayContaining([MESTRE_DA_AURORA]));
      expect(await equippedIds()).not.toEqual(expect.arrayContaining([CAJADO]));
    });
  });

  describe('retries and out-of-order delivery', () => {
    it('ends in the same state and emits user:planChanged once when the same event arrives twice', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));
      const body = subscriptionEvent('customer.subscription.deleted', 'canceled');

      expect((await signed(body)).status).toBe(200);
      const afterFirst = { status: (await row()).status, equipped: await equippedIds() };
      expect((await signed(body)).status).toBe(200);

      expect(await equippedIds()).toEqual(afterFirst.equipped);
      expect((await row()).status).toBe(afterFirst.status);
      expect((await row()).status).toBe('canceled');
      expect(await planTier()).toBe('free');
      expect(eventsNamed('user:planChanged')).toHaveLength(1);
      expect(eventsNamed('character:equipmentChanged')).toHaveLength(1);
    });

    it('emits user:planChanged once when the same event arrives twice at the same time', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));
      const body = subscriptionEvent('customer.subscription.deleted', 'canceled');

      const responses = await Promise.all([signed(body), signed(body), signed(body)]);

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
      expect(await planTier()).toBe('free');
      expect(eventsNamed('user:planChanged')).toHaveLength(1);
      expect(eventsNamed('character:equipmentChanged')).toHaveLength(1);
    });

    it('ends in the state the API reports whatever the order of the events', async () => {
      await seedFreeUser();
      retrieve.mockResolvedValue(stripeSubscription({ status: 'active' }));

      // Delivered newest first: the stale `created` carries `incomplete`, but only the API state counts.
      await signed(subscriptionEvent('customer.subscription.updated', 'active'));
      await signed(subscriptionEvent('customer.subscription.created', 'incomplete'));

      expect(await planTier()).toBe('premium');
      expect((await row()).status).toBe('active');
      expect(eventsNamed('user:planChanged')).toHaveLength(1);
    });

    it('ends canceled when a slow reread of an older event overlaps the faster reread of the cancellation', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      // The first reread answers `active` slowly; the second, sent 100 ms later, answers `canceled` at once.
      retrieve
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(stripeSubscription({ status: 'active' })), 500)))
        .mockResolvedValue(stripeSubscription({ status: 'canceled' }));

      const older = signed(subscriptionEvent('customer.subscription.updated', 'active'));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const newer = signed(subscriptionEvent('customer.subscription.deleted', 'canceled'));
      const responses = await Promise.all([older, newer]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect((await row()).status).toBe('canceled');
      expect(await planTier()).toBe('free');
      expect(await equippedIds()).not.toContain(MESTRE_DA_AURORA);
      expect(eventsNamed('user:planChanged').map((entry) => entry.payload).slice(-1)).toEqual([{ planTier: 'free' }]);
    });

    it('does not let a late event of an old, ended Subscription cancel the one the user subscribed to afterwards', async () => {
      await seedFreeUser();
      await dataSource!.getRepository(Subscription).update({ userId: user }, { stripeSubscriptionId: 'sub_new', status: 'active' });
      await dataSource!.getRepository(User).update({ id: user }, { planTier: 'premium' });
      retrieve.mockResolvedValue(stripeSubscription({ id: 'sub_old', status: 'canceled' }));

      const response = await signed(subscriptionEvent('customer.subscription.deleted', 'canceled', 'sub_old'));

      expect(response.status).toBe(200);
      expect(await planTier()).toBe('premium');
      expect((await row()).stripeSubscriptionId).toBe('sub_new');
      expect(emitted).toEqual([]);
    });
  });

  describe('failures', () => {
    it('answers 500 and writes nothing when the Stripe API fails to reread the Subscription', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      const before = await row();
      retrieve.mockRejectedValue(new Error('stripe is down'));
      jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const response = await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'));

      expect(response.status).toBe(500);
      expect(await row()).toEqual(before);
      expect(await planTier()).toBe('premium');
      expect(await equippedIds()).toContain(MESTRE_DA_AURORA);
      expect(emitted).toEqual([]);
    });

    it('undoes subscriptions, plan_tier and the equipment together, and emits nothing, when the last write fails', async () => {
      await seedPremiumUser([MESTRE_DA_AURORA]);
      const before = await row();
      const equippedBefore = await equippedIds();
      // The write that fails comes after the Subscription row, the plan and the unequip were already written.
      await dataSource!.query(`
        CREATE TRIGGER block_starter_equip BEFORE UPDATE ON user_cosmetic_items
        FOR EACH ROW BEGIN
          IF NEW.equipped = 1 AND OLD.equipped = 0 AND NEW.cosmetic_item_id = '${APRENDIZ}' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected failure';
          END IF;
        END`);
      retrieve.mockResolvedValue(stripeSubscription({ status: 'canceled' }));
      jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const response = await signed(subscriptionEvent('customer.subscription.deleted', 'canceled'));

      expect(response.status).toBe(500);
      expect(await row()).toEqual(before);
      expect(await planTier()).toBe('premium');
      expect(await equippedIds()).toEqual(equippedBefore);
      expect(emitted).toEqual([]);
    });
  });
});
