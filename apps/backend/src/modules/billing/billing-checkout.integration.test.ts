import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';
import type Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { APP_CREATE_OPTIONS } from '../../app.setup';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
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
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

const PRICE = 'price_test_premium';
const APP_URL = 'https://app.wise.test';
const CUSTOMER = 'cus_test_checkout';
const SESSION_URL = 'https://checkout.stripe.test/c/pay/cs_test_1';
const user = '00000000-0000-4000-8000-0000000000c1';

describe('POST /billing/checkout against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  // A fake Stripe client: no test calls the network.
  const createCustomer = jest.fn<Promise<Stripe.Customer>, [Stripe.CustomerCreateParams]>();
  const createSession = jest.fn<Promise<Stripe.Checkout.Session>, [Stripe.Checkout.SessionCreateParams]>();
  const stripeApi = {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
    customers: { create: createCustomer },
    checkout: { sessions: { create: createSession } },
  } as unknown as StripeApi;

  const start = async (stripe: StripeApi | null) => {
    const users = new UsersService(
      dataSource!.getRepository(User),
      dataSource!.getRepository(UserCosmeticItem),
      dataSource!.getRepository(CosmeticItem),
      {} as ProgressionService,
    );
    const settings: Record<string, string> = { STRIPE_PRICE_PREMIUM: PRICE, APP_URL };
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: STRIPE_API, useValue: stripe },
        { provide: ConfigService, useValue: { get: (key: string) => settings[key] } },
        { provide: UsersService, useValue: users },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn() } },
        { provide: getRepositoryToken(Subscription), useValue: dataSource!.getRepository(Subscription) },
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

  const checkout = (headers: Record<string, string> = { authorization: 'Bearer integration-token', 'x-test-user-id': user }) =>
    fetch(`${baseUrl}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{}',
    });

  const seedUser = (planTier: PlanTier) => dataSource!.getRepository(User).insert({
    id: user, email: 'aluno@example.com', passwordHash: 'hash', displayName: 'Aluno', planTier,
  });
  const rows = () => dataSource!.getRepository(Subscription).find();
  const detail = async (response: Response) => ((await response.json()) as { detail: string }).detail;

  beforeEach(async () => {
    createCustomer.mockReset().mockResolvedValue({ id: CUSTOMER } as Stripe.Customer);
    createSession.mockReset().mockResolvedValue({ id: 'cs_test_1', url: SESSION_URL } as Stripe.Checkout.Session);
    database = await createIntegrationDatabase('wise_billing_checkout');
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

  it('creates the Customer, stores it and answers 201 with the session url for a free user with no row', async () => {
    await seedUser('free');
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ url: SESSION_URL });
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(await rows()).toEqual([expect.objectContaining({
      userId: user, stripeCustomerId: CUSTOMER, stripeSubscriptionId: null, status: null,
    })]);
  });

  it('opens a subscription session for the premium Price that returns to the Plano screen', async () => {
    await seedUser('free');
    await start(stripeApi);

    await checkout();

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession.mock.calls[0]![0]).toEqual({
      mode: 'subscription',
      customer: CUSTOMER,
      line_items: [{ price: PRICE, quantity: 1 }],
      client_reference_id: user,
      success_url: `${APP_URL}/configuracao/plano?checkout=success`,
      cancel_url: `${APP_URL}/configuracao/plano?checkout=cancel`,
    });
  });

  it('reuses the stored Customer of a free user and creates no other', async () => {
    await seedUser('free');
    await dataSource!.getRepository(Subscription).insert({ userId: user, stripeCustomerId: 'cus_stored', status: 'canceled' });
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(201);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createSession.mock.calls[0]![0]).toMatchObject({ customer: 'cus_stored' });
    expect(await rows()).toEqual([expect.objectContaining({ stripeCustomerId: 'cus_stored' })]);
  });

  it('creates one Customer and one row for two calls in a row', async () => {
    await seedUser('free');
    await start(stripeApi);

    const first = await checkout();
    const second = await checkout();

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(createSession.mock.calls.map(([params]) => params.customer)).toEqual([CUSTOMER, CUSTOMER]);
    expect(await rows()).toHaveLength(1);
  });

  it('creates one Customer and one row for two calls at the same time', async () => {
    await seedUser('free');
    // A slow Customer: without a lock both calls would read "no row" and create one each.
    createCustomer.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { id: CUSTOMER } as Stripe.Customer;
    });
    await start(stripeApi);

    const statuses = (await Promise.all([checkout(), checkout()])).map((response) => response.status);

    expect(statuses).toEqual([201, 201]);
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(await rows()).toHaveLength(1);
  });

  it('answers 409 to a premium user without calling Stripe', async () => {
    await seedUser('premium');
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(409);
    expect(await detail(response)).toBe('Você já tem o plano premium');
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it('answers 503 when billing is not configured', async () => {
    await seedUser('free');
    await start(null);

    const response = await checkout();

    expect(response.status).toBe(503);
    expect(await detail(response)).toBe('Assinatura indisponível no momento');
    expect(await rows()).toEqual([]);
  });

  it('answers 502 and leaves no row when Stripe fails to create the Customer', async () => {
    await seedUser('free');
    createCustomer.mockRejectedValue(new Error('Stripe is down'));
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(502);
    expect(await detail(response)).toBe('Não foi possível abrir o pagamento');
    expect(createSession).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it('answers 502 and leaves no new row when Stripe fails to create the session', async () => {
    await seedUser('free');
    createSession.mockRejectedValue(new Error('Stripe is down'));
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(502);
    expect(await detail(response)).toBe('Não foi possível abrir o pagamento');
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(await rows()).toEqual([]);
  });

  it('keeps the existing row unchanged when Stripe fails to create the session', async () => {
    await seedUser('free');
    await dataSource!.getRepository(Subscription).insert({ userId: user, stripeCustomerId: 'cus_stored', status: 'canceled' });
    const before = await rows();
    createSession.mockRejectedValue(new Error('Stripe is down'));
    await start(stripeApi);

    const response = await checkout();

    expect(response.status).toBe(502);
    expect(await detail(response)).toBe('Não foi possível abrir o pagamento');
    expect(await rows()).toEqual(before);
  });

  it('answers 401 without a token', async () => {
    await seedUser('free');
    await start(stripeApi);

    const response = await checkout({});

    expect(response.status).toBe(401);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});
