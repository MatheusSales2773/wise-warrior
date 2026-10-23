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
import { xpForDuration } from '../sessions/domain/xp-rate';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { SessionsController } from '../sessions/sessions.controller';
import { StudySession } from '../sessions/entities/study-session.entity';
import { SessionsService } from '../sessions/sessions.service';
import { StudySessionEventsService } from '../sessions/study-session-events.service';
import { StudySessionStartService } from '../sessions/study-session-start.service';
import { StudySessionTransitionService } from '../sessions/study-session-transition.service';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { User } from '../users/entities/user.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersService } from '../users/users.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { ObjectivesController } from './objectives.controller';
import { ObjectivesService } from './objectives.service';

describe('Objetivos pay Moedas when a Study Session ends', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let objectives: ObjectivesService;
  let realtime: { emitToUser: jest.Mock };
  let baseUrl: string;
  let now: Date;
  let userId: string;

  const authSessionId = '00000000-0000-4000-8000-000000000f02';
  const send = (method: 'GET' | 'POST', path: string, idempotencyKey?: string, body?: unknown) =>
    fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        authorization: 'Bearer integration-token',
        'x-test-user-id': userId,
        'x-test-session-id': authSessionId,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** Finished sessions ending at each instant, with the given terminal shape and valid seconds. */
  const seedSessions = async (
    endedAts: string[],
    shape: { state?: 'completed' | 'stopped_early' | 'cancelled' | 'discarded'; kind?: 'cycle' | 'free'; mode?: 'solo' | 'guild'; cappedReason?: 'daily-limit' | 'continuous-limit'; validSeconds?: number; subject?: string | null } = {},
  ) => {
    await dataSource!.getRepository(StudySession).insert(endedAts.map((endedAt) => ({
      userId,
      mode: shape.mode ?? 'solo' as const,
      cappedReason: shape.cappedReason ?? null,
      kind: shape.kind ?? 'cycle',
      subject: shape.subject ?? null,
      state: shape.state ?? 'completed',
      discardedReason: shape.state === 'discarded' ? 'heartbeat-gap' : null,
      startedAt: new Date(new Date(endedAt).getTime() - 900_000),
      endedAt: new Date(endedAt),
      plannedDurationSeconds: 900,
      durationValidSeconds: shape.validSeconds ?? 900,
    })));
  };

  /** Starts a session through the API and moves its canonical deadline to `endsAt`; completing it ends it there. */
  const completeSessionEndingAt = async (key: string, endsAt: string, plannedDurationSeconds = 900) => {
    const started = await send('POST', '/sessions', `${key}-start`, { plannedDurationSeconds });
    const { id } = await started.json() as { id: string };
    const endedAt = new Date(endsAt);
    await dataSource!.getRepository(StudySession).update(
      { id },
      { startedAt: new Date(endedAt.getTime() - plannedDurationSeconds * 1000), runDeadlineAt: endedAt },
    );
    now = endedAt;
    return send('POST', `/sessions/${id}/complete`, `${key}-complete`, { expectedVersion: 1 });
  };

  const objectiveEntries = async () => {
    const rows = await dataSource!.getRepository(CoinLedgerEntry).find({ where: { userId, originType: 'objective' }, order: { originRef: 'ASC' } });
    return rows.map((row) => [row.originRef, row.amount]);
  };

  const dailyObjectives = async () => {
    const response = await send('GET', '/objectives');
    expect(response.status).toBe(200);
    return await response.json() as {
      daily: { date: string; renewsAt: string; items: Array<{ id: string; progress: number; target: number; completed: boolean; coins: number; title: string }> };
    };
  };

  const weeklyObjectives = async () => {
    const response = await send('GET', '/objectives');
    expect(response.status).toBe(200);
    return (await response.json() as {
      weekly: { weekStart: string; renewsAt: string; items: Array<{ id: string; progress: number; target: number; unit: string; completed: boolean; coins: number; title: string }> };
    }).weekly;
  };

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_objectives');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    now = new Date('2026-09-18T15:00:00.000Z');
    const config = { get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? 'integration-access-secret' : undefined) } as ConfigService;
    realtime = { emitToUser: jest.fn() };
    const gateway = realtime as unknown as RealtimeGateway;
    const users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService,
    );
    const progression = new ProgressionService(dataSource.getRepository(Character), gateway, users);
    const economy = new EconomyService(dataSource.getRepository(CoinBalance), dataSource.getRepository(CoinLedgerEntry), gateway);
    const auth = new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
      users,
      economy,
      { disconnectSessions: () => undefined } as never,
    );
    await auth.register({ email: 'veterana@example.com', password: 'senha-forte-123', displayName: 'Veterana' }, {});
    userId = (await dataSource.getRepository(User).findOneByOrFail({ email: 'veterana@example.com' })).id;

    const sessions = new SessionsService(dataSource.getRepository(StudySession), progression, {} as never);
    objectives = new ObjectivesService(economy, sessions, { now: () => new Date(now) });
    const events = new StudySessionEventsService(gateway);
    const transitions = new StudySessionTransitionService(
      dataSource, { now: () => new Date(now) }, progression, {} as never, economy, users, events, objectives,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController, ObjectivesController],
      providers: [
        { provide: SessionsService, useValue: { usesCanonicalStudySessionState: async () => true } },
        { provide: StudySessionStartService, useValue: new StudySessionStartService(dataSource, users, {} as never, transitions, events) },
        { provide: StudySessionTransitionService, useValue: transitions },
        { provide: ObjectivesService, useValue: objectives },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          if (request.headers.authorization !== 'Bearer integration-token') throw new UnauthorizedException();
          request.user = { sub: request.headers['x-test-user-id']!, sessionId: request.headers['x-test-session-id']! } as JwtPayload;
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

  it('credits "Conclua 1 sessão de foco" when the first session ends, with its own Extrato origin', async () => {
    expect((await completeSessionEndingAt('first', '2026-09-18T15:00:00.000Z')).status).toBe(200);

    expect(await objectiveEntries()).toEqual([['one-session:2026-09-18', 5]]);
    expect(realtime.emitToUser).toHaveBeenCalledWith(userId, 'coins:changed', expect.objectContaining({ delta: 5, origin: { type: 'objective', ref: 'one-session:2026-09-18' } }));
  });

  it('credits "Conclua 4 sessões hoje" once, on the 4th session, even when more sessions follow', async () => {
    await seedSessions(['2026-09-18T12:00:00.000Z', '2026-09-18T12:30:00.000Z']);
    await completeSessionEndingAt('third', '2026-09-18T13:00:00.000Z');
    expect((await objectiveEntries()).map(([ref]) => ref)).not.toContain('four-sessions:2026-09-18');

    await completeSessionEndingAt('fourth', '2026-09-18T14:00:00.000Z');
    await completeSessionEndingAt('fifth', '2026-09-18T15:00:00.000Z');

    expect((await objectiveEntries()).filter(([ref]) => String(ref).startsWith('four-sessions'))).toEqual([['four-sessions:2026-09-18', 15]]);
  });

  it('credits "Faça uma sessão de 50 minutos" only for 50 valid minutes in a single session', async () => {
    await seedSessions(['2026-09-18T11:00:00.000Z', '2026-09-18T12:00:00.000Z'], { validSeconds: 2000 });
    await completeSessionEndingAt('short', '2026-09-18T13:00:00.000Z');
    expect((await objectiveEntries()).map(([ref]) => ref)).not.toContain('fifty-minutes:2026-09-18');

    await completeSessionEndingAt('long', '2026-09-18T15:00:00.000Z', 3000);

    expect(await objectiveEntries()).toContainEqual(['fifty-minutes:2026-09-18', 10]);
  });

  it('counts Foco livre and early stops like any finished session', async () => {
    await seedSessions(['2026-09-18T11:00:00.000Z'], { kind: 'free' });
    await seedSessions(['2026-09-18T12:00:00.000Z'], { state: 'stopped_early' });

    expect((await dailyObjectives()).daily.items.find(({ id }) => id === 'four-sessions')?.progress).toBe(2);
  });

  it('counts a truncated session and a guild-mode session like any other', async () => {
    await seedSessions(['2026-09-18T11:00:00.000Z'], { cappedReason: 'daily-limit' });
    await seedSessions(['2026-09-18T12:00:00.000Z'], { mode: 'guild' });

    expect((await dailyObjectives()).daily.items.find(({ id }) => id === 'four-sessions')?.progress).toBe(2);
  });

  it('never grants XP or Raid contribution for an Objetivo: the XP is the focus of the live session alone', async () => {
    await seedSessions(['2026-09-18T11:00:00.000Z', '2026-09-18T12:00:00.000Z', '2026-09-18T13:00:00.000Z']);

    expect((await completeSessionEndingAt('fourth', '2026-09-18T15:00:00.000Z')).status).toBe(200);

    expect(await objectiveEntries()).toContainEqual(['four-sessions:2026-09-18', 15]);
    const character = await dataSource!.getRepository(Character).findOneByOrFail({ userId });
    expect(character.xpTotal).toBe(xpForDuration(900));
  });

  it('answers 401 to an unauthenticated read', async () => {
    const response = await fetch(`${baseUrl}/api/v1/objectives`);
    expect(response.status).toBe(401);
  });

  it('does not advance with cancellations or discarded sessions', async () => {
    await seedSessions(['2026-09-18T11:00:00.000Z', '2026-09-18T11:30:00.000Z'], { state: 'cancelled' });
    await seedSessions(['2026-09-18T12:00:00.000Z', '2026-09-18T12:30:00.000Z'], { state: 'discarded' });

    const { daily } = await dailyObjectives();

    expect(daily.items.map(({ progress }) => progress)).toEqual([0, 0, 0]);
    expect(await objectiveEntries()).toEqual([]);
  });

  it('puts a session on the São Paulo day it ended: 02:59:59 UTC is still the day before', async () => {
    await seedSessions(['2026-09-19T02:59:59.000Z', '2026-09-18T15:00:00.000Z']);
    expect((await completeSessionEndingAt('late', '2026-09-19T03:00:00.000Z')).status).toBe(200);

    expect(await objectiveEntries()).toEqual([['one-session:2026-09-19', 5]]);

    now = new Date('2026-09-19T03:00:01.000Z');
    const { daily } = await dailyObjectives();
    expect(daily.date).toBe('2026-09-19');
    expect(daily.items.find(({ id }) => id === 'one-session')?.progress).toBe(1);
    expect(daily.items.find(({ id }) => id === 'four-sessions')?.progress).toBe(1);
  });

  it('renews at the next midnight of São Paulo', async () => {
    now = new Date('2026-09-18T15:00:00.000Z');
    const { daily } = await dailyObjectives();
    expect(daily.renewsAt).toBe('2026-09-19T03:00:00.000Z');
  });

  it('lists the objectives with their coins', async () => {
    const { daily } = await dailyObjectives();
    expect(daily.items.map(({ title, coins, target }) => [title, coins, target])).toEqual([
      ['Conclua 1 sessão de foco', 5, 1],
      ['Conclua 4 sessões hoje', 15, 4],
      ['Faça uma sessão de 50 minutos', 10, 1],
    ]);
  });

  it('never pays the same objective twice for a day, even when reprocessed', async () => {
    await seedSessions(['2026-09-18T12:00:00.000Z']);
    const settle = () => dataSource!.transaction((manager) => objectives.settleInTransaction(manager, userId, new Date('2026-09-18T12:00:00.000Z')));

    const first = await settle();
    const second = await settle();

    expect(first.filter((movement) => movement.applied)).toHaveLength(1);
    expect(second.filter((movement) => movement.applied)).toHaveLength(0);
    expect(await objectiveEntries()).toEqual([['one-session:2026-09-18', 5]]);
  });

  it('pays each day on its own', async () => {
    await completeSessionEndingAt('monday', '2026-09-18T15:00:00.000Z');
    await completeSessionEndingAt('tuesday', '2026-09-19T15:00:00.000Z');

    expect(await objectiveEntries()).toEqual([['one-session:2026-09-18', 5], ['one-session:2026-09-19', 5]]);
  });

  it('does not grant Moedas twice when the completion is replayed', async () => {
    const started = await send('POST', '/sessions', 'replay-start', { plannedDurationSeconds: 900 });
    const { id } = await started.json() as { id: string };
    const endedAt = new Date('2026-09-18T15:00:00.000Z');
    await dataSource!.getRepository(StudySession).update({ id }, { startedAt: new Date(endedAt.getTime() - 900_000), runDeadlineAt: endedAt });
    now = endedAt;

    await send('POST', `/sessions/${id}/complete`, 'replay-complete', { expectedVersion: 1 });
    await send('POST', `/sessions/${id}/complete`, 'replay-complete', { expectedVersion: 1 });

    expect(await objectiveEntries()).toEqual([['one-session:2026-09-18', 5]]);
  });

  describe('weekly', () => {
    // 2026-09-14 is a Monday in São Paulo; `now` starts on Friday the 18th.
    const weeklyEntries = async () => (await objectiveEntries()).filter(([ref]) => String(ref).includes('2026-09-14'));

    it('lists the three objectives with coins, targets and the Monday renewal', async () => {
      const weekly = await weeklyObjectives();
      expect(weekly.weekStart).toBe('2026-09-14');
      expect(weekly.renewsAt).toBe('2026-09-21T03:00:00.000Z');
      expect(weekly.items.map(({ title, coins, target, unit }) => [title, coins, target, unit])).toEqual([
        ['Estude em 5 dias diferentes', 40, 5, 'days'],
        ['Estude 5h nesta semana', 50, 300, 'minutes'],
        ['Estude 3 matérias diferentes', 30, 3, 'subjects'],
      ]);
    });

    it('pays "5 dias diferentes" once, on the 5th day, and not for several sessions on one day', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-14T16:00:00.000Z', '2026-09-15T15:00:00.000Z', '2026-09-16T15:00:00.000Z', '2026-09-17T15:00:00.000Z'], { validSeconds: 60 });
      expect((await completeSessionEndingAt('d5', '2026-09-17T18:00:00.000Z')).status).toBe(200);
      expect((await weeklyObjectives()).items[0]).toMatchObject({ progress: 4, completed: false });
      expect(await weeklyEntries()).toEqual([]);

      expect((await completeSessionEndingAt('d6', '2026-09-18T15:00:00.000Z')).status).toBe(200);
      expect((await completeSessionEndingAt('d7', '2026-09-19T15:00:00.000Z')).status).toBe(200);

      expect(await weeklyEntries()).toEqual([['weekly:five-days:2026-09-14', 40]]);
      expect((await weeklyObjectives()).items[0]).toMatchObject({ progress: 5, completed: true });
    });

    it('pays "5h nesta semana" when the valid focus of the week reaches 300 minutes', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-15T15:00:00.000Z'], { validSeconds: 8100 });
      await seedSessions(['2026-09-16T15:00:00.000Z'], { validSeconds: 1200 });
      expect((await weeklyObjectives()).items[1]).toMatchObject({ progress: 290, completed: false });

      expect((await completeSessionEndingAt('h', '2026-09-18T15:00:00.000Z', 900)).status).toBe(200);

      expect(await weeklyEntries()).toEqual([['weekly:five-hours:2026-09-14', 50]]);
    });

    it('pays "3 matérias diferentes" grouping subjects like the Diário', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z'], { subject: 'Cálculo' });
      await seedSessions(['2026-09-15T15:00:00.000Z'], { subject: ' cálculo ' });
      await seedSessions(['2026-09-16T15:00:00.000Z'], { subject: 'Física' });
      await seedSessions(['2026-09-16T16:00:00.000Z']);
      expect((await weeklyObjectives()).items[2]).toMatchObject({ progress: 2, completed: false });

      await seedSessions(['2026-09-16T17:00:00.000Z'], { subject: 'História' });
      expect((await completeSessionEndingAt('s', '2026-09-16T18:00:00.000Z')).status).toBe(200);

      expect(await weeklyEntries()).toEqual([['weekly:three-subjects:2026-09-14', 30]]);
    });

    it('is reachable in solo mode and never grants XP or Raid contribution', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-15T15:00:00.000Z', '2026-09-16T15:00:00.000Z', '2026-09-17T15:00:00.000Z'], { mode: 'solo', validSeconds: 60 });
      expect((await completeSessionEndingAt('solo', '2026-09-18T15:00:00.000Z')).status).toBe(200);
      expect(await weeklyEntries()).toEqual([['weekly:five-days:2026-09-14', 40]]);
    });

    it('ignores cancellations and discarded sessions', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-15T15:00:00.000Z'], { state: 'discarded', subject: 'Cálculo' });
      await seedSessions(['2026-09-16T15:00:00.000Z'], { state: 'cancelled', subject: 'Física' });

      expect((await weeklyObjectives()).items.map(({ progress }) => progress)).toEqual([0, 0, 0]);
    });

    it('turns the week from Sunday 23:59:59 to Monday 00:00 in São Paulo', async () => {
      // Sunday 2026-09-20 23:59:59 SP is 2026-09-21T02:59:59Z: still the week of the 14th.
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-15T15:00:00.000Z', '2026-09-16T15:00:00.000Z', '2026-09-17T15:00:00.000Z'], { validSeconds: 60 });
      expect((await completeSessionEndingAt('sunday', '2026-09-21T02:59:59.000Z')).status).toBe(200);
      expect(await weeklyEntries()).toEqual([['weekly:five-days:2026-09-14', 40]]);

      now = new Date('2026-09-21T02:59:59.000Z');
      expect((await weeklyObjectives()).items[0]).toMatchObject({ progress: 5, completed: true });

      // Monday 00:00 SP starts a fresh week: nothing carries over and nothing is paid again.
      expect((await completeSessionEndingAt('monday', '2026-09-21T03:00:00.000Z')).status).toBe(200);
      const weekly = await weeklyObjectives();
      expect(weekly.weekStart).toBe('2026-09-21');
      expect(weekly.renewsAt).toBe('2026-09-28T03:00:00.000Z');
      expect(weekly.items.map(({ progress }) => progress)).toEqual([1, 15, 0]);
      expect((await objectiveEntries()).filter(([ref]) => String(ref).startsWith('weekly:five-'))).toEqual([['weekly:five-days:2026-09-14', 40]]);
    });

    it('never pays the same objective twice in a week, even when reprocessed', async () => {
      await seedSessions(['2026-09-14T15:00:00.000Z', '2026-09-15T15:00:00.000Z', '2026-09-16T15:00:00.000Z', '2026-09-17T15:00:00.000Z', '2026-09-18T15:00:00.000Z'], { validSeconds: 60 });
      const settle = () => dataSource!.transaction((manager) => objectives.settleInTransaction(manager, userId, new Date('2026-09-18T15:00:00.000Z')));

      const first = await settle();
      const second = await settle();

      expect(first.filter((movement) => movement.applied)).toHaveLength(2);
      expect(second.filter((movement) => movement.applied)).toHaveLength(0);
      expect(await weeklyEntries()).toEqual([['weekly:five-days:2026-09-14', 40]]);
    });
  });
});
