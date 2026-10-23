import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/entities/session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../shared/security/rate-limit';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CoinBalance } from '../economy/entities/coin-balance.entity';
import { CoinLedgerEntry } from '../economy/entities/coin-ledger-entry.entity';
import { EconomyService } from '../economy/economy.service';
import { Character } from '../progression/entities/character.entity';
import { StudySession } from './entities/study-session.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersController } from '../users/users.controller';
import { UsersService, type CatalogCosmeticItem } from '../users/users.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionEventsService } from './study-session-events.service';
import { StudySessionTransitionService } from './study-session-transition.service';

describe('Session-count Badge unlock at the end of a Study Session', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let users: UsersService;
  let baseUrl: string;
  let now: Date;
  let userId: string;

  const authSessionId = '00000000-0000-4000-8000-000000000f01';
  const headers = () => ({
    authorization: 'Bearer integration-token',
    'x-test-user-id': userId,
    'x-test-session-id': authSessionId,
  });

  const send = (method: 'GET' | 'POST', path: string, idempotencyKey?: string, body?: unknown) =>
    fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        ...headers(),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** Starts a Study Session and lets its canonical deadline pass, so completing it awards its XP. */
  const startSession = async (plannedDurationSeconds: number, key: string) => {
    const started = await send('POST', '/sessions', `${key}-start`, { plannedDurationSeconds });
    const snapshot = await started.json() as { id: string; startedAt: string };
    now = new Date(new Date(snapshot.startedAt).getTime() + plannedDurationSeconds * 1000);
    const path = `/sessions/${snapshot.id}/complete`;
    return { path, complete: () => send('POST', path, `${key}-complete`, { expectedVersion: 1 }) };
  };

  const unlockedNames = async () => {
    const response = await send('GET', '/users/me/cosmetics');
    const catalog = await response.json() as CatalogCosmeticItem[];
    return catalog.filter((item) => item.unlocked).map((item) => item.name).sort();
  };

  const MADRUGADOR = 'Madrugador';
  const CEM_SESSOES = 'Cem Sessões';

  /** Finished sessions that ended `endedAts`, one per instant, with the given terminal shape. */
  const seedSessions = async (
    endedAts: string[],
    shape: { state?: 'completed' | 'stopped_early' | 'cancelled' | 'discarded'; discardedReason?: string } = {},
  ) => {
    await dataSource!.getRepository(StudySession).insert(endedAts.map((endedAt) => ({
      userId,
      mode: 'solo' as const,
      state: shape.state ?? 'completed',
      discardedReason: shape.discardedReason ?? null,
      startedAt: new Date(new Date(endedAt).getTime() - 900_000),
      endedAt: new Date(endedAt),
      plannedDurationSeconds: 900,
      durationValidSeconds: 900,
    })));
  };

  /** Days before the session under test, at the given UTC time of day. */
  const daysBefore = (count: number, utcTime: string) =>
    Array.from({ length: count }, (_, index) => `2026-09-${String(17 - index).padStart(2, '0')}T${utcTime}Z`);

  /** `count` finished-session instants one day apart from `from`, at 15:00 UTC (12h in São Paulo, not early). */
  const spreadDays = (count: number, from = '2026-01-01') =>
    Array.from({ length: count }, (_, index) => new Date(Date.parse(`${from}T15:00:00Z`) + index * 86_400_000).toISOString());

  /** Starts a session through the API, then moves it so its canonical deadline is `endsAt`. */
  const startSessionEndingAt = async (key: string, endsAt = '2026-09-18T09:15:00.000Z') => {
    const session = await startSession(900, key);
    const endedAt = new Date(endsAt);
    const [id] = session.path.split('/').slice(-2);
    await dataSource!.getRepository(StudySession).update(
      { id },
      { startedAt: new Date(endedAt.getTime() - 900_000), runDeadlineAt: endedAt },
    );
    now = endedAt;
    return session;
  };

  /** Completes a real session that ends at 2026-09-18 06:15 in São Paulo (09:15 UTC), or at `endsAt`. */
  const completeSessionEndingAt = async (key: string, endsAt = '2026-09-18T09:15:00.000Z') =>
    (await startSessionEndingAt(key, endsAt)).complete();

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_session_badges');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    now = new Date();
    const config = {
      get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'integration-access-secret' : undefined),
    } as ConfigService;
    const realtime = { emitToUser: jest.fn() } as unknown as RealtimeGateway;
    // Users and progression reference each other; the profile read is not exercised here.
    users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService,
    );
    const progression = new ProgressionService(dataSource.getRepository(Character), realtime, users);
    const auth = new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
      users,
      new EconomyService(
        dataSource.getRepository(CoinBalance),
        dataSource.getRepository(CoinLedgerEntry),
        { emitToUser: () => undefined } as never,
      ),
      { disconnectSessions: () => undefined } as never,
    );
    await auth.register({ email: 'veterana@example.com', password: 'senha-forte-123', displayName: 'Veterana' }, {});
    userId = (await dataSource.getRepository(User).findOneByOrFail({ email: 'veterana@example.com' })).id;

    const events = new StudySessionEventsService(realtime);
    const transitions = new StudySessionTransitionService(
      dataSource,
      { now: () => new Date(now) },
      progression,
      {} as never,
      new EconomyService(dataSource.getRepository(CoinBalance), dataSource.getRepository(CoinLedgerEntry), realtime),
      users,
      events,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController, UsersController],
      providers: [
        { provide: SessionsService, useValue: { usesCanonicalStudySessionState: async () => true } },
        { provide: StudySessionStartService, useValue: new StudySessionStartService(dataSource, users, {} as never, transitions, events) },
        { provide: StudySessionTransitionService, useValue: transitions },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: JwtPayload;
          }>();
          if (request.headers.authorization !== 'Bearer integration-token') throw new UnauthorizedException();
          request.user = {
            sub: request.headers['x-test-user-id']!,
            sessionId: request.headers['x-test-session-id']!,
          } as JwtPayload;
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

  it('unlocks Madrugador when the 5th session ends before 7h in São Paulo', async () => {
    await seedSessions(daysBefore(4, '09:00:00'));
    expect(await unlockedNames()).not.toContain(MADRUGADOR);

    const completed = await completeSessionEndingAt('early-5');

    expect(completed.status).toBe(200);
    expect(await unlockedNames()).toContain(MADRUGADOR);
  });

  it('does not count sessions from 7h on, cancellations or discarded sessions as early', async () => {
    await seedSessions(daysBefore(2, '09:00:00'));
    await seedSessions(daysBefore(1, '10:00:00')); // 07h in São Paulo
    await seedSessions(daysBefore(2, '09:30:00'), { state: 'cancelled' });
    await seedSessions(daysBefore(2, '09:40:00'), { discardedReason: 'heartbeat-gap' });
    await seedSessions(daysBefore(2, '09:50:00'), { state: 'discarded', discardedReason: 'heartbeat-gap' });

    const completed = await completeSessionEndingAt('early-4');

    expect(completed.status).toBe(200);
    expect(await unlockedNames()).not.toContain(MADRUGADOR);
  });

  it('counts the São Paulo hour, not the UTC one: 03:00 UTC is midnight in São Paulo', async () => {
    await seedSessions(daysBefore(4, '03:00:00'));

    expect((await completeSessionEndingAt('midnight')).status).toBe(200);

    expect(await unlockedNames()).toContain(MADRUGADOR);
  });

  it('does not unlock Madrugador or Cem Sessões by level', async () => {
    await dataSource!.getRepository(Character).update({ userId }, { xpTotal: 40_000, level: 12 });

    expect((await completeSessionEndingAt('late', '2026-09-18T13:15:00.000Z')).status).toBe(200);

    expect(await unlockedNames()).toEqual(['Aprendiz', 'Capuz do Erudito', 'Espada']);
  });

  it('unlocks Cem Sessões on the 100th non-discarded session, counting stopped-early ones only', async () => {
    await seedSessions(spreadDays(90));
    await seedSessions(spreadDays(8, '2026-03-01'), { state: 'stopped_early' });
    await seedSessions(spreadDays(5, '2026-04-01'), { state: 'cancelled' });
    await seedSessions(spreadDays(5, '2026-05-01'), { discardedReason: 'heartbeat-gap' });

    expect((await completeSessionEndingAt('ninety-ninth', '2026-09-18T15:00:00.000Z')).status).toBe(200);
    expect(await unlockedNames()).not.toContain(CEM_SESSOES);

    expect((await completeSessionEndingAt('hundredth', '2026-09-19T15:00:00.000Z')).status).toBe(200);
    expect(await unlockedNames()).toContain(CEM_SESSOES);
  });

  it('grants a Badge once, without equipping it, when more sessions or a replay follow', async () => {
    await seedSessions(daysBefore(4, '09:00:00'));
    const session = await startSessionEndingAt('early-once');
    expect((await session.complete()).status).toBe(200);
    expect((await session.complete()).status).toBe(200);
    expect((await completeSessionEndingAt('early-six', '2026-09-19T09:15:00.000Z')).status).toBe(200);

    const rows = await dataSource!.getRepository(UserCosmeticItem).find({ where: { userId }, relations: ['cosmeticItem'] });
    const madrugador = rows.filter((row) => row.cosmeticItem.name === MADRUGADOR);
    expect(madrugador).toHaveLength(1);
    expect(madrugador[0]?.equipped).toBe(false);
  });

  it('unlocks nothing when the completion transaction fails', async () => {
    await seedSessions(daysBefore(4, '09:00:00'));
    await dataSource!.query('DROP TABLE study_session_transition_receipts');

    expect((await completeSessionEndingAt('rollback')).status).toBe(500);

    expect(await unlockedNames()).not.toContain(MADRUGADOR);
  });
});
