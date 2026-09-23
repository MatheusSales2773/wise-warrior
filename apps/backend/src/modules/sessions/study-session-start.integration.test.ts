import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { StudySession } from './entities/study-session.entity';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService } from './study-session-transition.service';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';

async function expectConflictType(promise: Promise<unknown>, type: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ type });
    return;
  }
  throw new Error(`Expected conflict problem ${type}`);
}

describe('canonical Study Session start against MySQL', () => {
  jest.setTimeout(30_000);
  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  const userId = '00000000-0000-4000-8000-000000000070';
  const createService = () => new StudySessionStartService(
    dataSource!, new UsersService({} as never, {} as never, {} as never, {} as never),
  );

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_study_start');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({ id: userId, email: 'focus@example.com', passwordHash: 'hash', displayName: 'Focus', planTier: 'free' });
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await database?.close();
  });

  it('returns absence, defaults to 25 minutes and restores only for the initiating Session', async () => {
    const service = createService();
    expect(await service.active(userId, 'device-a')).toBeNull();
    for (const invalidBody of [
      { plannedDurationSeconds: null }, 42, 'x', true, [], null,
    ]) {
      await expect(service.start(userId, 'device-a', invalidBody as never, 'invalid-request')).rejects.toThrow();
    }

    const started = await service.start(userId, 'device-a', {}, 'request-a');
    expect(started).toMatchObject({ mode: 'solo', subject: null, state: 'running', plannedDurationSeconds: 1500, remainingSeconds: 1500, version: 1, canControl: true });
    expect(started.runDeadlineAt!.getTime() - started.startedAt.getTime()).toBe(1_500_000);
    expect(started).not.toHaveProperty('initiatingSessionId');
    expect(started).toEqual(expect.objectContaining({
      id: expect.any(String), mode: 'solo', subject: null, state: 'running',
      plannedDurationSeconds: 1500, startedAt: expect.any(Date), runDeadlineAt: expect.any(Date),
      pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: expect.any(Number),
      serverNow: expect.any(Date), version: 1, endedAt: null, xpAwarded: 0,
      terminalReason: null, discardedReason: null, canControl: true,
    }));
    expect(await service.active(userId, 'device-a')).toMatchObject({ id: started.id, canControl: true });
    expect(await service.active(userId, 'device-b')).toMatchObject({ id: started.id, canControl: false });
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: started.id });
    expect(persisted).toMatchObject({ subject: null, raidId: null, mode: 'solo', initiatingSessionId: 'device-a' });
  });

  it('serializes concurrent starts and preserves the first receipt', async () => {
    const service = createService();
    const results = await Promise.allSettled([
      service.start(userId, 'device-a', { plannedDurationSeconds: 900 }, 'request-a'),
      service.start(userId, 'device-b', { plannedDurationSeconds: 3000 }, 'request-b'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await dataSource!.getRepository(StudySession).count({ where: { userId, state: 'running' } })).toBe(1);
    expect(await dataSource!.query('SELECT user_id, study_session_id FROM active_study_sessions WHERE user_id = ?', [userId]))
      .toHaveLength(1);
    const uniqueActiveIndex = await dataSource!.query(
      `SELECT NON_UNIQUE FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_sessions'
         AND INDEX_NAME = 'UQ_study_sessions_active_user'`,
    ) as Array<{ NON_UNIQUE: number | string }>;
    expect(uniqueActiveIndex.length).toBeGreaterThan(0);
    expect(uniqueActiveIndex.every((index) => Number(index.NON_UNIQUE) === 0)).toBe(true);
    const winner = results.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.start>>> => result.status === 'fulfilled')!.value;
    const loser = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')!;
    expect(loser.reason).toBeInstanceOf(ConflictException);
    expect((loser.reason as ConflictException).getResponse()).toMatchObject({
      type: 'https://wise.app/errors/study-session-active',
    });
    const repeated = await service.start(userId, winner.canControl ? 'device-a' : 'device-b', { plannedDurationSeconds: winner.plannedDurationSeconds as 900 | 3000 }, winner.plannedDurationSeconds === 900 ? 'request-a' : 'request-b');
    expect(repeated.id).toBe(winner.id);
    expect(repeated.serverNow).toEqual(winner.serverNow);
    await expectConflictType(
      service.start(
        userId,
        'device-a',
        { plannedDurationSeconds: winner.plannedDurationSeconds === 900 ? 3000 : 900 },
        winner.plannedDurationSeconds === 900 ? 'request-a' : 'request-b',
      ),
      'https://wise.app/errors/idempotency-key-reused',
    );
  });

  it('keeps idempotency keys unique across start and transition commands while preserving retries', async () => {
    const startService = createService();
    const started = await startService.start(userId, 'device-a', { plannedDurationSeconds: 1500 }, 'shared-start-key');
    const transitionService = new StudySessionTransitionService(
      dataSource!,
      { now: () => new Date(started.startedAt.getTime() + 30_000) },
      {} as never,
    );
    const pause = (idempotencyKey: string) => transitionService.pause({
      userId,
      authSessionId: 'device-a',
      studySessionId: started.id,
      dto: { expectedVersion: 1 },
      idempotencyKey,
    });

    await expectConflictType(pause('shared-start-key'), 'https://wise.app/errors/idempotency-key-reused');

    const paused = await pause('shared-transition-key');
    await expectConflictType(
      startService.start(userId, 'device-a', { plannedDurationSeconds: 1500 }, 'shared-transition-key'),
      'https://wise.app/errors/idempotency-key-reused',
    );

    // Simulate receipts left by an older release before the shared key table existed.
    await dataSource!.query(
      `INSERT INTO study_session_transition_receipts
       (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, started.id, 'shared-start-key', 'pause', 1, JSON.stringify(paused)],
    );
    expect(await dataSource!.query(
      'SELECT command_kind FROM study_session_command_keys WHERE user_id = ? AND idempotency_key = ?',
      [userId, 'shared-start-key'],
    )).toEqual([{ command_kind: 'start' }]);
    await expect(pause('shared-start-key')).resolves.toEqual(paused);
    await expectConflictType(
      transitionService.resume({
        userId,
        authSessionId: 'device-a',
        studySessionId: started.id,
        dto: { expectedVersion: 2 },
        idempotencyKey: 'shared-start-key',
      }),
      'https://wise.app/errors/idempotency-key-reused',
    );

    await expect(startService.start(userId, 'device-a', { plannedDurationSeconds: 1500 }, 'shared-start-key'))
      .resolves.toEqual(started);
    await expect(pause('shared-transition-key')).resolves.toEqual(paused);
  });
});
