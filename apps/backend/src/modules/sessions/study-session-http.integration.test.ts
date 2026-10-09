import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Character } from '../progression/entities/character.entity';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/entities/user.entity';
import { CosmeticItem } from '../users/entities/cosmetic-item.entity';
import { UserCosmeticItem } from '../users/entities/user-cosmetic-item.entity';
import { UsersService } from '../users/users.service';
import { HttpExceptionFilter } from '../../shared/filters/http-exception.filter';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { StudySession } from './entities/study-session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';

describe('Study Session HTTP contract against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let now: Date;

  const userId = '00000000-0000-4000-8000-000000000076';
  const otherUserId = '00000000-0000-4000-8000-000000000077';
  const ownerSessionId = '00000000-0000-4000-8000-000000000078';
  const otherSessionId = '00000000-0000-4000-8000-000000000079';
  const foreignStudySessionId = '00000000-0000-4000-8000-000000000080';
  const authHeaders = (authenticatedSessionId: string) => ({
    authorization: 'Bearer integration-token',
    'x-test-user-id': userId,
    'x-test-session-id': authenticatedSessionId,
  });

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_study_http');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert([
      { id: userId, email: 'http-focus@example.com', passwordHash: 'hash', displayName: 'HTTP Focus', planTier: 'free' },
      { id: otherUserId, email: 'http-other@example.com', passwordHash: 'hash', displayName: 'HTTP Other', planTier: 'free' },
    ]);

    now = new Date();
    const users = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserCosmeticItem),
      dataSource.getRepository(CosmeticItem),
      {} as ProgressionService, // the profile read is not exercised here
    );
    const progression = new ProgressionService(
      dataSource.getRepository(Character),
      { emitToUser: jest.fn() } as unknown as RealtimeGateway,
      users,
    );
    const start = new StudySessionStartService(dataSource, users);
    const transitions = new StudySessionTransitionService(dataSource, { now: () => new Date(now) }, progression);
    const controllerModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionsService, useValue: { usesCanonicalStudySessionState: async () => true } },
        { provide: StudySessionStartService, useValue: start },
        { provide: StudySessionTransitionService, useValue: transitions },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const requestContext = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: JwtPayload;
          }>();
          if (requestContext.headers.authorization !== 'Bearer integration-token') {
            throw new UnauthorizedException();
          }
          requestContext.user = {
            sub: requestContext.headers['x-test-user-id']!,
            sessionId: requestContext.headers['x-test-session-id']!,
          } as JwtPayload;
          return true;
        },
      })
      .compile();

    app = controllerModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    await dataSource.getRepository(StudySession).insert({
      id: foreignStudySessionId,
      userId: otherUserId,
      subject: 'Private historical subject',
      mode: 'solo',
      raidId: null,
      startedAt: now,
      lastHeartbeatAt: now,
      plannedDurationSeconds: 900,
      state: 'running',
      runDeadlineAt: new Date(now.getTime() + 900_000),
      pausedAt: null,
      pausedTotalSeconds: 0,
      pausedTotalMilliseconds: 0,
      version: 1,
      terminalReason: null,
      initiatingSessionId: otherSessionId,
      durationValidSeconds: 0,
      xpAwarded: 0,
      discardedReason: null,
    });
    await dataSource.query(
      'INSERT INTO active_study_sessions (user_id, study_session_id) VALUES (?, ?)',
      [otherUserId, foreignStudySessionId],
    );
  });

  afterEach(async () => {
    await app?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('returns real REST snapshots, RFC 7807 conflicts, and indistinguishable missing-resource problems', async () => {
    const send = (
      method: 'GET' | 'POST',
      path: string,
      authenticatedSessionId: string,
      idempotencyKey?: string,
      body?: unknown,
    ) => fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        ...authHeaders(authenticatedSessionId),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const started = await send('POST', '/sessions', ownerSessionId, 'http-start', { plannedDurationSeconds: 900 });
    const startedSnapshot = await started.json() as { id: string; startedAt: string; [field: string]: unknown };

    expect(started.status).toBe(201);
    expect(started.headers.get('content-type')).toContain('application/json');
    expect(startedSnapshot).toMatchObject({
      mode: 'solo', subject: null, state: 'running', plannedDurationSeconds: 900,
      version: 1, xpAwarded: 0, canControl: true,
    });
    expect(startedSnapshot).not.toHaveProperty('initiatingSessionId');

    const otherDeviceSnapshotResponse = await send('GET', '/sessions/active', otherSessionId);
    const otherDeviceSnapshot = await otherDeviceSnapshotResponse.json() as { id: string; canControl: boolean };
    expect(otherDeviceSnapshotResponse.status).toBe(200);
    expect(otherDeviceSnapshot).toMatchObject({ id: startedSnapshot.id, canControl: false });
    expect(otherDeviceSnapshot).not.toHaveProperty('initiatingSessionId');

    const remotePause = await send('POST', `/sessions/${startedSnapshot.id}/pause`, otherSessionId, 'http-remote-pause', { expectedVersion: 1 });
    const remotePauseProblem = await remotePause.json();
    expect(remotePause.status).toBe(409);
    expect(remotePause.headers.get('content-type')).toContain('application/problem+json');
    expect(remotePauseProblem).toEqual({
      type: 'https://wise.app/errors/study-session-not-controllable',
      title: 'ConflictException',
      status: 409,
      detail: 'Esta Study Session só pode ser controlada pela Session autenticada que a iniciou',
      instance: `/api/v1/sessions/${startedSnapshot.id}/pause`,
    });

    now = new Date(startedSnapshot.startedAt);
    now.setTime(now.getTime() + 30_000);
    const paused = await send('POST', `/sessions/${startedSnapshot.id}/pause`, ownerSessionId, 'http-pause', { expectedVersion: 1 });
    const pausedSnapshot = await paused.json();
    expect(paused.status).toBe(200);
    expect(pausedSnapshot).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 30, canControl: true });

    const keyReuse = await send('POST', '/sessions', ownerSessionId, 'http-pause', { plannedDurationSeconds: 900 });
    const keyReuseProblem = await keyReuse.json();
    expect(keyReuse.status).toBe(409);
    expect(keyReuse.headers.get('content-type')).toContain('application/problem+json');
    expect(keyReuseProblem).toEqual({
      type: 'https://wise.app/errors/idempotency-key-reused',
      title: 'ConflictException',
      status: 409,
      detail: 'Idempotency-Key já foi usada por outro comando',
      instance: '/api/v1/sessions',
    });

    const missingId = '00000000-0000-4000-8000-000000000081';
    const foreignProblem = await send('POST', `/sessions/${foreignStudySessionId}/pause`, ownerSessionId, 'http-foreign-session', { expectedVersion: 1 });
    const missingProblem = await send('POST', `/sessions/${missingId}/pause`, ownerSessionId, 'http-missing-session', { expectedVersion: 1 });
    const foreignProblemBody = await foreignProblem.json() as Record<string, unknown>;
    const missingProblemBody = await missingProblem.json() as Record<string, unknown>;

    expect(foreignProblem.status).toBe(404);
    expect(missingProblem.status).toBe(404);
    expect(foreignProblem.headers.get('content-type')).toContain('application/problem+json');
    expect(missingProblem.headers.get('content-type')).toContain('application/problem+json');
    expect(foreignProblemBody).toMatchObject({
      type: 'https://wise.app/errors/404',
      title: 'NotFoundException',
      status: 404,
      detail: 'Study Session não encontrada',
      instance: `/api/v1/sessions/${foreignStudySessionId}/pause`,
    });
    expect(missingProblemBody).toMatchObject({
      type: foreignProblemBody.type,
      title: foreignProblemBody.title,
      status: foreignProblemBody.status,
      detail: foreignProblemBody.detail,
      instance: `/api/v1/sessions/${missingId}/pause`,
    });
    expect(JSON.stringify(foreignProblemBody)).not.toContain('Private historical subject');
    expect(JSON.stringify(foreignProblemBody)).not.toContain(otherUserId);
  });

  it('starts with a normalized Matéria, refuses invalid ones with problem+json and keeps the snapshot on transitions', async () => {
    const send = (method: 'GET' | 'POST', path: string, idempotencyKey?: string, body?: unknown) => fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        ...authHeaders(ownerSessionId),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    for (const [index, subject] of ['a'.repeat(81), 'Cálculo\nII', 'Cálculo\tII', 'Cál\u0000culo', 42, ['Cálculo']].entries()) {
      const invalid = await send('POST', '/sessions', `http-invalid-subject-${index}`, { subject });
      const problem = await invalid.json() as { type: string; status: number; instance: string };
      expect(invalid.status).toBe(400);
      expect(invalid.headers.get('content-type')).toContain('application/problem+json');
      expect(problem).toMatchObject({ type: 'https://wise.app/errors/400', status: 400, instance: '/api/v1/sessions' });
    }
    expect(await dataSource!.getRepository(StudySession).count({ where: { userId } })).toBe(0);

    const body = { plannedDurationSeconds: 900, subject: '  Cálculo   II ' };
    const started = await send('POST', '/sessions', 'http-subject', body);
    const startedSnapshot = await started.json() as { id: string; startedAt: string; subject: string | null };
    expect(started.status).toBe(201);
    expect(startedSnapshot).toMatchObject({ subject: 'Cálculo II', state: 'running' });

    const replay = await send('POST', '/sessions', 'http-subject', { plannedDurationSeconds: 900, subject: 'Cálculo II' });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(startedSnapshot);

    for (const otherBody of [{ plannedDurationSeconds: 900, subject: 'Cálculo III' }, { plannedDurationSeconds: 900 }, { plannedDurationSeconds: 900, subject: null }]) {
      const reused = await send('POST', '/sessions', 'http-subject', otherBody);
      expect(reused.status).toBe(409);
      expect(reused.headers.get('content-type')).toContain('application/problem+json');
      expect(await reused.json()).toMatchObject({ type: 'https://wise.app/errors/idempotency-key-reused', status: 409 });
    }

    const active = await send('GET', '/sessions/active');
    expect(await active.json()).toMatchObject({ id: startedSnapshot.id, subject: 'Cálculo II' });

    now = new Date(new Date(startedSnapshot.startedAt).getTime() + 30_000);
    const paused = await send('POST', `/sessions/${startedSnapshot.id}/pause`, 'http-subject-pause', { expectedVersion: 1 });
    expect(await paused.json()).toMatchObject({ state: 'paused', subject: 'Cálculo II' });
    const resumed = await send('POST', `/sessions/${startedSnapshot.id}/resume`, 'http-subject-resume', { expectedVersion: 2 });
    expect(await resumed.json()).toMatchObject({ state: 'running', subject: 'Cálculo II' });
    const cancelled = await send('POST', `/sessions/${startedSnapshot.id}/stop`, 'http-subject-stop', { expectedVersion: 3 });
    expect(await cancelled.json()).toMatchObject({ subject: 'Cálculo II' });

    for (const [index, payload] of [{}, { subject: null }, { subject: '   ' }].entries()) {
      const session = await send('POST', '/sessions', `http-no-subject-${index}`, payload);
      const snapshot = await session.json() as { id: string; subject: string | null };
      expect(session.status).toBe(201);
      expect(snapshot.subject).toBeNull();
      await dataSource!.query('DELETE FROM active_study_sessions WHERE user_id = ?', [userId]);
      await dataSource!.getRepository(StudySession).update({ id: snapshot.id }, { state: 'cancelled' });
    }
  });
});
