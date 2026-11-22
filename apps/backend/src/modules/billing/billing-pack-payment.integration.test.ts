import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { APP_CREATE_OPTIONS } from '../../app.setup';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createMigratedIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { ProgressionService } from '../progression/progression.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { User, type PlanTier } from '../users/entities/user.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersService } from '../users/users.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Pack } from './entities/pack.entity';
import { PackPayment } from './entities/pack-payment.entity';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

const WEBHOOK_SECRET = 'test-webhook-signing-secret';
const APP_URL = 'https://app.wise.test';
const CUSTOMER = 'cus_test_pack';
const SESSION_URL = 'https://checkout.stripe.test/c/pay/cs_test_pack';
const user = '00000000-0000-4000-8000-0000000000d1';
const otherUser = '00000000-0000-4000-8000-0000000000d2';

describe('Pagar o Pacote (S7) against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let users: UsersService;

  // The real SDK only for its offline signature code; every call that would reach Stripe is a fake.
  const signer = new Stripe('test-key-that-never-reaches-the-network');
  const createCustomer = jest.fn<Promise<Stripe.Customer>, [Stripe.CustomerCreateParams]>();
  const createSession = jest.fn<Promise<Stripe.Checkout.Session>, [Stripe.Checkout.SessionCreateParams]>();
  const retrieveSession = jest.fn<Promise<Stripe.Checkout.Session>, [string]>();
  const emitted: Array<{ userId: string; event: string; payload: unknown; paymentsWhenEmitted: Promise<number> }> = [];
  // Counted through the pool, a connection other than the transaction's: it sees the Pagamento only once committed.
  const realtime = {
    emitToUser: jest.fn((userId: string, event: string, payload: unknown) => {
      emitted.push({
        userId, event, payload,
        paymentsWhenEmitted: dataSource!.query('SELECT COUNT(*) AS n FROM pack_payments').then((rows: Array<{ n: string }>) => Number(rows[0]!.n)),
      });
    }),
  };
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  const start = async (stripe: StripeApi | null) => {
    const settings: Record<string, string | undefined> = {
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, APP_URL, STRIPE_SECRET_KEY: stripe ? 'sk_test_never_used' : undefined,
    };
    const config = { get: (key: string) => settings[key] } as ConfigService;
    users = new UsersService(
      dataSource!.getRepository(User),
      dataSource!.getRepository(UserCosmeticItem),
      dataSource!.getRepository(CosmeticItem),
      {} as ProgressionService,
      config,
      realtime as unknown as RealtimeGateway,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: STRIPE_API, useValue: stripe },
        { provide: ConfigService, useValue: config },
        { provide: UsersService, useValue: users },
        { provide: RealtimeGateway, useValue: realtime },
        { provide: getRepositoryToken(Subscription), useValue: dataSource!.getRepository(Subscription) },
        { provide: getRepositoryToken(Pack), useValue: dataSource!.getRepository(Pack) },
        { provide: getRepositoryToken(PackPayment), useValue: dataSource!.getRepository(PackPayment) },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          if (request.headers.authorization !== 'Bearer integration-token') throw new UnauthorizedException();
          request.user = { sub: request.headers['x-test-user-id']! } as JwtPayload;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication(APP_CREATE_OPTIONS);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useLogger(false);
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  };
  const fakeStripe = (): StripeApi => ({
    webhooks: signer.webhooks,
    subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
    customers: { create: createCustomer },
    checkout: { sessions: { create: createSession, retrieve: retrieveSession } },
    billingPortal: { sessions: { create: jest.fn() } },
  });

  const seedUser = (planTier: PlanTier = 'free', id = user) => dataSource!.getRepository(User).insert({
    id, email: `${id}@example.com`, passwordHash: 'hash', displayName: 'Aluno', planTier,
  });
  const dragao = () => dataSource!.getRepository(Pack).findOneByOrFail({ slug: 'dragao' });
  const packItemIds = async () => (await dataSource!.getRepository(CosmeticItem).find({ where: { unlockCondition: 'pack:dragao' } }))
    .map((item) => item.id).sort();
  const payments = () => dataSource!.getRepository(PackPayment).find();
  const inventory = (id = user) => dataSource!.getRepository(UserCosmeticItem).find({ where: { userId: id } });

  const checkout = (slug = 'dragao', headers: Record<string, string> = { authorization: 'Bearer integration-token', 'x-test-user-id': user }) =>
    fetch(`${baseUrl}/api/v1/billing/packs/${slug}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{}',
    });
  const detail = async (response: Response) => ((await response.json()) as { detail: string }).detail;

  const paidSession = (overrides: Partial<Stripe.Checkout.Session> = {}) => ({
    id: 'cs_test_paid',
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: user,
    metadata: { packSlug: 'dragao' },
    amount_total: 490,
    currency: 'brl',
    ...overrides,
  }) as Stripe.Checkout.Session;
  const completed = (sessionId = 'cs_test_paid', eventId = 'evt_1') => JSON.stringify({
    id: eventId, object: 'event', type: 'checkout.session.completed',
    // The payload says paid with another amount: only what the API returns may be stored.
    data: { object: { id: sessionId, object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 1 } },
  });
  const webhook = (body: string) => fetch(`${baseUrl}/api/v1/billing/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signer.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }),
    },
    body,
  });

  beforeEach(async () => {
    emitted.length = 0;
    realtime.emitToUser.mockClear();
    warn.mockClear();
    createCustomer.mockReset().mockResolvedValue({ id: CUSTOMER } as Stripe.Customer);
    createSession.mockReset().mockResolvedValue({ id: 'cs_test_pack', url: SESSION_URL } as Stripe.Checkout.Session);
    retrieveSession.mockReset().mockResolvedValue(paidSession());
    database = await createMigratedIntegrationDatabase('wise_billing_pack_payment');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  describe('POST /billing/packs/:slug/checkout', () => {
    it('creates the Customer and answers 201 with the url of a one-time session for the Pacote price', async () => {
      await seedUser();
      await start(fakeStripe());

      const response = await checkout();

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ url: SESSION_URL });
      expect(createCustomer).toHaveBeenCalledTimes(1);
      expect(await dataSource!.getRepository(Subscription).find()).toEqual([
        expect.objectContaining({ userId: user, stripeCustomerId: CUSTOMER, stripeSubscriptionId: null }),
      ]);
      expect(createSession).toHaveBeenCalledWith({
        mode: 'payment',
        allowed_payment_method_types: ['card'],
        customer: CUSTOMER,
        line_items: [{
          price_data: { currency: 'brl', unit_amount: 490, product_data: { name: 'Pacote do Dragão' } },
          quantity: 1,
        }],
        client_reference_id: user,
        metadata: { packSlug: 'dragao' },
        success_url: `${APP_URL}/mercado?secao=pacotes&checkout=success`,
        cancel_url: `${APP_URL}/mercado?secao=pacotes&checkout=cancel`,
      });
    });

    it('reads the amount from packs, not from a constant', async () => {
      await seedUser();
      await dataSource!.getRepository(Pack).update({ slug: 'dragao' }, { priceCents: 1290 });
      await start(fakeStripe());

      await checkout();

      expect(createSession.mock.calls[0]![0].line_items![0]).toMatchObject({ price_data: { unit_amount: 1290 } });
    });

    it('reuses the stored Customer and keeps one row, for a buyer with a Customer already and for two calls at once', async () => {
      await seedUser();
      await dataSource!.getRepository(Subscription).insert({ userId: user, stripeCustomerId: 'cus_existing' });
      await start(fakeStripe());

      const responses = await Promise.all([checkout(), checkout()]);

      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(createCustomer).not.toHaveBeenCalled();
      expect(createSession.mock.calls.map(([params]) => params.customer)).toEqual(['cus_existing', 'cus_existing']);
      expect(await dataSource!.getRepository(Subscription).count()).toBe(1);
    });

    it('creates one Customer for two first calls at the same time', async () => {
      await seedUser();
      await start(fakeStripe());

      await Promise.all([checkout(), checkout()]);

      expect(createCustomer).toHaveBeenCalledTimes(1);
      expect(await dataSource!.getRepository(Subscription).count()).toBe(1);
    });

    it('answers 409 "Você já tem este Pacote" without calling Stripe when the user already paid it', async () => {
      await seedUser();
      await dataSource!.getRepository(PackPayment).insert({
        userId: user, packId: (await dragao()).id, stripeCheckoutSessionId: 'cs_old', amountCents: 490, currency: 'brl', paidAt: new Date(),
      });
      await start(fakeStripe());

      const response = await checkout();

      expect(response.status).toBe(409);
      expect(await detail(response)).toBe('Você já tem este Pacote');
      expect(createCustomer).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });

    it('answers 409, not 404, to a user who paid a Pacote that left the shelf', async () => {
      await seedUser();
      await dataSource!.getRepository(Pack).update({ slug: 'dragao' }, { forSale: false });
      await dataSource!.getRepository(PackPayment).insert({
        userId: user, packId: (await dragao()).id, stripeCheckoutSessionId: 'cs_old', amountCents: 490, currency: 'brl', paidAt: new Date(),
      });
      await start(fakeStripe());

      expect((await checkout()).status).toBe(409);
    });

    it('answers 404 "Pacote não encontrado" for an unknown slug and for a Pacote off sale the user did not pay', async () => {
      await seedUser();
      await start(fakeStripe());

      const unknown = await checkout('nao-existe');
      await dataSource!.getRepository(Pack).update({ slug: 'dragao' }, { forSale: false });
      const offSale = await checkout();

      expect([unknown.status, offSale.status]).toEqual([404, 404]);
      expect(await detail(unknown)).toBe('Pacote não encontrado');
      expect(await detail(offSale)).toBe('Pacote não encontrado');
      expect(createSession).not.toHaveBeenCalled();
    });

    it('answers 503 "Pagamento indisponível no momento" when billing is not configured', async () => {
      await seedUser();
      await start(null);

      const response = await checkout();

      expect(response.status).toBe(503);
      expect(await detail(response)).toBe('Pagamento indisponível no momento');
    });

    it('answers 502 "Não foi possível abrir o pagamento" and leaves no row when Stripe fails', async () => {
      await seedUser();
      createSession.mockRejectedValue(new Error('stripe is down'));
      await start(fakeStripe());

      const response = await checkout();

      expect(response.status).toBe(502);
      expect(await detail(response)).toBe('Não foi possível abrir o pagamento');
      expect(await dataSource!.getRepository(Subscription).count()).toBe(0);
    });

    it('answers 401 without a token', async () => {
      await start(fakeStripe());

      expect((await checkout('dragao', {})).status).toBe(401);
    });
  });

  describe('checkout.session.completed of a Pacote', () => {
    it('stores the Pagamento with the amount and currency of the session read from the API, gives the 3 items unequipped and emits user:packGranted after the commit', async () => {
      await seedUser();
      await start(fakeStripe());
      retrieveSession.mockResolvedValue(paidSession({ amount_total: 490, currency: 'brl' }));

      const response = await webhook(completed());

      expect(response.status).toBe(200);
      expect(retrieveSession).toHaveBeenCalledWith('cs_test_paid');
      expect(await payments()).toEqual([
        expect.objectContaining({ userId: user, packId: (await dragao()).id, stripeCheckoutSessionId: 'cs_test_paid', amountCents: 490, currency: 'brl' }),
      ]);
      const ids = await packItemIds();
      expect(ids).toHaveLength(3);
      expect((await inventory()).map((row) => [row.cosmeticItemId, row.equipped]).sort()).toEqual(ids.map((id) => [id, false]).sort());
      expect(emitted).toEqual([expect.objectContaining({ userId: user, event: 'user:packGranted', payload: { slug: 'dragao', cosmeticItemIds: expect.arrayContaining(ids) } })]);
      expect(await emitted[0]!.paymentsWhenEmitted).toBe(1);
      expect((emitted[0]!.payload as { cosmeticItemIds: string[] }).cosmeticItemIds).toHaveLength(3);
    });

    it('answers 200 and writes nothing when the session read from the API is not paid, whatever the payload says', async () => {
      await seedUser();
      await start(fakeStripe());
      retrieveSession.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));

      const response = await webhook(completed());

      expect(response.status).toBe(200);
      expect(await payments()).toEqual([]);
      expect(await inventory()).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it.each([
      ['no_payment_required', { payment_status: 'no_payment_required' }],
      ['a session that is not a one-time payment', { mode: 'subscription' }],
    ] as const)('answers 200 and writes nothing for %s read from the API', async (_label, overrides) => {
      await seedUser();
      await start(fakeStripe());
      retrieveSession.mockResolvedValue(paidSession(overrides as Partial<Stripe.Checkout.Session>));

      const response = await webhook(completed());

      expect(response.status).toBe(200);
      expect(await payments()).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it('answers 200, writes nothing and logs the session when the payer no longer exists', async () => {
      await start(fakeStripe());

      const response = await webhook(completed());

      expect(response.status).toBe(200);
      expect(await payments()).toEqual([]);
      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cs_test_paid'));
    });

    it('still gives the items of a Pacote that left the shelf after the session was opened', async () => {
      await seedUser();
      await dataSource!.getRepository(Pack).update({ slug: 'dragao' }, { forSale: false });
      await start(fakeStripe());

      await webhook(completed());

      expect(await payments()).toHaveLength(1);
      expect(await inventory()).toHaveLength(3);
    });

    it('answers 500 and writes nothing when Stripe fails to return the session, so Stripe retries', async () => {
      await seedUser();
      await start(fakeStripe());
      retrieveSession.mockRejectedValue(new Error('stripe is down'));

      const response = await webhook(completed());

      expect(response.status).toBe(500);
      expect(await payments()).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it('keeps one Pagamento, no duplicate item and no second event when the same event arrives again, one after another or at once', async () => {
      await seedUser();
      await start(fakeStripe());

      const statuses = [(await webhook(completed())).status];
      statuses.push((await webhook(completed())).status);
      const [third, fourth] = await Promise.all([webhook(completed()), webhook(completed())]);
      statuses.push(third.status, fourth.status);

      expect(statuses).toEqual([200, 200, 200, 200]);
      expect(await payments()).toHaveLength(1);
      expect(await inventory()).toHaveLength(3);
      expect(emitted.filter((entry) => entry.event === 'user:packGranted')).toHaveLength(1);
    });

    it('keeps one Pagamento and logs the id of the session of a second paid checkout of the same Pacote', async () => {
      await seedUser();
      await start(fakeStripe());
      await webhook(completed());
      retrieveSession.mockResolvedValue(paidSession({ id: 'cs_test_second' }));

      const response = await webhook(completed('cs_test_second', 'evt_2'));

      expect(response.status).toBe(200);
      expect(await payments()).toEqual([expect.objectContaining({ stripeCheckoutSessionId: 'cs_test_paid' })]);
      expect(emitted).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cs_test_second'));
    });

    it('does not touch another user\'s Inventário', async () => {
      await seedUser();
      await seedUser('free', otherUser);
      await start(fakeStripe());

      await webhook(completed());

      expect(await inventory(otherUser)).toEqual([]);
    });
  });

  describe('equipping an item of the Pacote', () => {
    it('lets a free user equip an item of a Pacote they paid, with billing configured', async () => {
      await seedUser('free');
      await start(fakeStripe());
      await webhook(completed());
      const presa = await dataSource!.getRepository(CosmeticItem).findOneByOrFail({ name: 'Presa do Dragão' });

      await users.equipCosmeticItem(user, presa.id);

      expect(await dataSource!.getRepository(UserCosmeticItem).findOneByOrFail({ userId: user, cosmeticItemId: presa.id }))
        .toEqual(expect.objectContaining({ equipped: true }));
    });
  });
});
