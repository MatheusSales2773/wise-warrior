import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
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
const CUSTOMER = 'cus_test_dev_reset';
const DEV_EMAIL = 'dev@example.com';
const user = '00000000-0000-4000-8000-0000000000c1';

describe('POST /billing/dev/reset-plan against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  // A fake Stripe client: no test calls the network.
  const createCustomer = jest.fn();
  const createCheckout = jest.fn();
  const cancel = jest.fn<Promise<Stripe.Subscription>, [string]>();
  const stripeApi = {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn(), cancel },
    customers: { create: createCustomer },
    checkout: { sessions: { create: createCheckout } },
  } as unknown as StripeApi;

  const settings: Record<string, string> = { STRIPE_PRICE_PREMIUM: PRICE, APP_URL, DEV_TOOLS_EMAILS: ` Other@example.com , ${DEV_EMAIL.toUpperCase()}` };

  const start = async (stripe: StripeApi | null) => {
    const users = new UsersService(
      dataSource!.getRepository(User),
      dataSource!.getRepository(UserCosmeticItem),
      dataSource!.getRepository(CosmeticItem),
      {} as ProgressionService,
      { get: (key: string) => settings[key] } as ConfigService,
    );
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
  const reset = (headers?: Record<string, string>) => call('POST', 'dev/reset-plan', headers);

  const seedUser = (planTier: PlanTier, email = DEV_EMAIL, id = user) => dataSource!.getRepository(User).insert({
    id, email, passwordHash: 'hash', displayName: 'Aluno', planTier,
  });
  const planTierOf = async () => (await dataSource!.getRepository(User).findOneByOrFail({ id: user })).planTier;
  const seedRow = (userId: string, customer: string, extra: Partial<Subscription> = {}) =>
    dataSource!.getRepository(Subscription).insert({ userId, stripeCustomerId: customer, ...extra });
  const rows = () => dataSource!.getRepository(Subscription).find();
  const detail = async (response: Response) => ((await response.json()) as { detail: string }).detail;

  beforeEach(async () => {
    cancel.mockReset().mockResolvedValue({ id: 'sub_test_1', status: 'canceled' } as Stripe.Subscription);
    createCheckout.mockReset();
    createCustomer.mockReset();
    database = await createIntegrationDatabase('wise_billing_dev_reset');
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

  describe('POST /billing/dev/reset-plan', () => {
    it.each(['active', 'trialing', 'past_due'])('answers 202 with no body and cancels now the Subscription of a listed user that is %s', async (status) => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status });
      await start(stripeApi);

      const response = await reset();

      expect(response.status).toBe(202);
      expect(await response.text()).toBe('');
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledWith('sub_test_1');
    });

    it('cancels the Subscription of the caller, not of another user', async () => {
      const other = '00000000-0000-4000-8000-0000000000c2';
      await seedUser('premium');
      await seedUser('premium', 'other@example.com', other);
      await seedRow(other, 'cus_test_other', { stripeSubscriptionId: 'sub_test_other', status: 'active' });
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      await reset();

      expect(cancel).toHaveBeenCalledWith('sub_test_1');
    });

    it('writes nothing on a 202: the plan and the row stay as they were', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      const before = await rows();
      await start(stripeApi);

      expect((await reset()).status).toBe(202);

      expect(await planTierOf()).toBe('premium');
      expect(await rows()).toEqual(before);
    });

    it('answers 404 without calling Stripe to a user that is not listed, even with an active Subscription', async () => {
      await seedUser('premium', 'devx@example.com');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      expect((await reset()).status).toBe(404);
      expect(cancel).not.toHaveBeenCalled();
    });

    it('answers 404, not 503, to a user that is not listed when billing is not configured', async () => {
      await seedUser('premium', 'devx@example.com');
      await start(null);

      expect((await reset()).status).toBe(404);
    });

    it('answers 404, not 409, to a user that is not listed and has no Subscription', async () => {
      await seedUser('free', 'devx@example.com');
      await start(stripeApi);

      expect((await reset()).status).toBe(404);
    });

    it('answers 401 without a token', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(stripeApi);

      expect((await reset({})).status).toBe(401);
      expect(cancel).not.toHaveBeenCalled();
    });

    it('answers 503 to a listed user when billing is not configured', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      await start(null);

      const response = await reset();

      expect(response.status).toBe(503);
      expect(await detail(response)).toBe('Assinatura indisponível no momento');
    });

    it.each([
      ['has no row', undefined],
      ['has a row with only the Customer', { status: null }],
      ['has a canceled Subscription', { stripeSubscriptionId: 'sub_test_1', status: 'canceled' }],
    ])('answers 409 without calling Stripe to a listed user that %s', async (_name, extra) => {
      await seedUser('free');
      if (extra) await seedRow(user, CUSTOMER, extra);
      await start(stripeApi);

      const response = await reset();

      expect(response.status).toBe(409);
      expect(await detail(response)).toBe('Nenhuma assinatura para cancelar');
      expect(cancel).not.toHaveBeenCalled();
    });

    it('answers 502, logs the user id and keeps the row when Stripe fails to cancel', async () => {
      await seedUser('premium');
      await seedRow(user, CUSTOMER, { stripeSubscriptionId: 'sub_test_1', status: 'active' });
      const before = await rows();
      cancel.mockRejectedValue(new Error('Stripe is down'));
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await start(stripeApi);

      const response = await reset();

      expect(response.status).toBe(502);
      expect(await detail(response)).toBe('Não foi possível cancelar a assinatura');
      expect(await rows()).toEqual(before);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining(user));
      logged.mockRestore();
    });
  });
});
