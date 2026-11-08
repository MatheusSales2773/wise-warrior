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
import { Pack } from './entities/pack.entity';
import { PackPayment } from './entities/pack-payment.entity';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

const PRICE = 'price_test_premium';
const APP_URL = 'https://app.wise.test';
const CUSTOMER = 'cus_test_portal';
const PORTAL_URL = 'https://billing.stripe.test/p/session/test_1';
const user = '00000000-0000-4000-8000-0000000000c1';

describe('POST /billing/portal and GET /billing/subscription against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  // A fake Stripe client: no test calls the network.
  const createCustomer = jest.fn();
  const createCheckout = jest.fn();
  const createPortal = jest.fn<Promise<Stripe.BillingPortal.Session>, [Stripe.BillingPortal.SessionCreateParams]>();
  const stripeApi = {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
    customers: { create: createCustomer },
    checkout: { sessions: { create: createCheckout } },
    billingPortal: { sessions: { create: createPortal } },
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

  const call = (method: 'GET' | 'POST', path: string, headers: Record<string, string> = { authorization: 'Bearer integration-token', 'x-test-user-id': user }) =>
    fetch(`${baseUrl}/api/v1/billing/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(method === 'POST' && { body: '{}' }),
    });
  const portal = (headers?: Record<string, string>) => call('POST', 'portal', headers);
  const subscription = (headers?: Record<string, string>) => call('GET', 'subscription', headers);

  const seedUser = (planTier: PlanTier, id = user) => dataSource!.getRepository(User).insert({
    id, email: `${id}@example.com`, passwordHash: 'hash', displayName: 'Aluno', planTier,
  });
  const seedRow = (userId: string, customer: string, extra: Partial<Subscription> = {}) =>
    dataSource!.getRepository(Subscription).insert({ userId, stripeCustomerId: customer, ...extra });
  const rows = () => dataSource!.getRepository(Subscription).find();
  const detail = async (response: Response) => ((await response.json()) as { detail: string }).detail;

  beforeEach(async () => {
    createPortal.mockReset().mockResolvedValue({ id: 'bps_test_1', url: PORTAL_URL } as Stripe.BillingPortal.Session);
    createCheckout.mockReset();
    createCustomer.mockReset();
    database = await createIntegrationDatabase('wise_billing_portal');
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

  describe('POST /billing/portal', () => {
    it('answers 201 with the Portal url for a user with a Subscription', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      const response = await portal();

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ url: PORTAL_URL });
    });

    it('opens the Portal for the Customer of the caller that returns to the Plano screen', async () => {
      const other = '00000000-0000-4000-8000-0000000000c2';
      await seedUser('premium');
      await seedUser('premium', other);
      await seedRow(other, 'cus_test_other', { stripeSubscriptionId: 'sub_test_other', status: 'active' });
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      await portal();

      expect(createPortal).toHaveBeenCalledTimes(1);
      expect(createPortal.mock.calls[0]![0]).toEqual({ customer: CUSTOMER, return_url: `${APP_URL}/configuracao/plano` });
    });

    it('answers 409 to a user that never opened a Checkout', async () => {
      await seedUser('free');
      await start(stripeApi);

      const response = await portal();

      expect(response.status).toBe(409);
      expect(await detail(response)).toBe('Nenhuma assinatura para gerenciar');
      expect(createPortal).not.toHaveBeenCalled();
    });

    it('answers 409 to a user whose row has no Subscription', async () => {
      await seedUser('free');
      await seedRow(user, CUSTOMER);
      await start(stripeApi);

      const response = await portal();

      expect(response.status).toBe(409);
      expect(await detail(response)).toBe('Nenhuma assinatura para gerenciar');
      expect(createPortal).not.toHaveBeenCalled();
    });

    it('answers 503 when billing is not configured', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(null);

      const response = await portal();

      expect(response.status).toBe(503);
      expect(await detail(response)).toBe('Assinatura indisponível no momento');
    });

    it('answers 502 and keeps the row when Stripe fails to create the Portal session', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      const before = await rows();
      createPortal.mockRejectedValue(new Error('Stripe is down'));
      await start(stripeApi);

      const response = await portal();

      expect(response.status).toBe(502);
      expect(await detail(response)).toBe('Não foi possível abrir o pagamento');
      expect(await rows()).toEqual(before);
    });

    it('answers 401 without a token to the Portal', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      const response = await portal({});

      expect(response.status).toBe(401);
      expect(createPortal).not.toHaveBeenCalled();
    });
  });

  describe('GET /billing/subscription', () => {
    it('answers premiumUntil with the cancel_at of a premium user that cancelled in the Portal', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, {
        stripeSubscriptionId: 'sub_test_1',
        status: 'active',
        currentPeriodEnd: new Date('2026-12-08T12:00:00.000Z'),
        cancelAt: new Date('2026-12-01T12:00:00.000Z'),
      });
      await start(stripeApi);

      const response = await subscription();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        available: true,
        planTier: 'premium',
        status: 'active',
        renewsAt: null,
        premiumUntil: '2026-12-01T12:00:00.000Z',
      });
    });

    it('answers 401 without a token to the subscription', async () => {
      await seedUser('premium');
      await start(stripeApi);

      expect((await subscription({})).status).toBe(401);
    });
  });
});
