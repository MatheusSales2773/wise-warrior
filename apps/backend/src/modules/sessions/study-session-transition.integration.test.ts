import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StudySession } from './entities/study-session.entity';
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

describe('Study Session pause and resume against MySQL', () => {
  jest.setTimeout(30_000);
  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let service: StudySessionTransitionService;
  let now: Date;
  const userId = '00000000-0000-4000-8000-000000000071';
  const authSessionId = '00000000-0000-4000-8000-000000000072';
  const studySessionId = '00000000-0000-4000-8000-000000000073';

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_study_transition');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({ id: userId, email: 'pause@example.com', passwordHash: 'hash', displayName: 'Pause', planTier: 'free' });

    now = new Date('2026-09-22T12:00:00.000Z');
    await dataSource.getRepository(StudySession).insert({
      id: studySessionId,
      userId,
      subject: null,
      mode: 'solo',
      raidId: null,
      startedAt: now,
      plannedDurationSeconds: 1800,
      state: 'running',
      runDeadlineAt: new Date(now.getTime() + 1_800_000),
      pausedAt: null,
      pausedTotalSeconds: 0,
      pausedTotalMilliseconds: 0,
      version: 1,
      terminalReason: null,
      initiatingSessionId: authSessionId,
      durationValidSeconds: 0,
      xpAwarded: 0,
      discardedReason: null,
    });
    await dataSource.query('INSERT INTO active_study_sessions (user_id, study_session_id) VALUES (?, ?)', [userId, studySessionId]);
    service = new StudySessionTransitionService(dataSource, { now: () => new Date(now) });
  });

  afterEach(async () => {
    await dataSource?.destroy();
    await database?.close();
  });

  it('freezes focus at pause and restores the same remaining time on resume', async () => {
    now = new Date(now.getTime() + 300_000);
    const paused = await service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-once');

    expect(paused).toMatchObject({ state: 'paused', remainingSeconds: 1500, durationValidSeconds: 300, pausedTotalSeconds: 0, version: 2 });
    expect(paused.serverNow).toEqual(now);

    now = new Date(now.getTime() + 600_000);
    const resumed = await service.resume(userId, authSessionId, studySessionId, { expectedVersion: 2 }, 'resume-once');

    expect(resumed).toMatchObject({ state: 'running', remainingSeconds: 1500, durationValidSeconds: 300, pausedTotalSeconds: 600, version: 3, xpAwarded: 0 });
    expect(resumed.runDeadlineAt).toEqual(new Date('2026-09-22T12:40:00.000Z'));
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'running', durationValidSeconds: 300, pausedTotalSeconds: 600, version: 3, xpAwarded: 0 });
  });

  it('returns the original receipt for retries and rejects stale versions and key reuse', async () => {
    now = new Date(now.getTime() + 300_000);
    const paused = await service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-once');
    now = new Date(now.getTime() + 60_000);

    const replay = await service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-once');
    expect(replay).toEqual(paused);
    await expectConflictType(
      service.resume(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stale-resume'),
      'https://wise.app/errors/study-session-version-conflict',
    );
    await expectConflictType(
      service.resume(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-once'),
      'https://wise.app/errors/idempotency-key-reused',
    );

    const anotherStudySessionId = '00000000-0000-4000-8000-000000000074';
    await dataSource!.getRepository(StudySession).insert({
      id: anotherStudySessionId,
      userId,
      subject: null,
      mode: 'solo',
      raidId: null,
      startedAt: now,
      endedAt: now,
      plannedDurationSeconds: 1800,
      state: 'completed',
      runDeadlineAt: now,
      pausedAt: null,
      pausedTotalSeconds: 0,
      pausedTotalMilliseconds: 0,
      version: 1,
      terminalReason: null,
      initiatingSessionId: authSessionId,
      durationValidSeconds: 0,
      xpAwarded: 0,
      discardedReason: null,
    });
    await expectConflictType(
      service.pause(userId, authSessionId, anotherStudySessionId, { expectedVersion: 1 }, 'pause-once'),
      'https://wise.app/errors/idempotency-key-reused',
    );

    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 300, xpAwarded: 0 });
  });

  it('serializes concurrent pause commands so exactly one version change wins', async () => {
    now = new Date(now.getTime() + 300_000);
    const results = await Promise.allSettled([
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-first'),
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-second'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(ConflictException);
      expect((rejected.reason as ConflictException).getResponse()).toMatchObject({
        type: 'https://wise.app/errors/study-session-version-conflict',
      });
    }

    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 300 });
  });

  it('returns one original receipt for concurrent retries with the same user key', async () => {
    now = new Date(now.getTime() + 300_000);
    const responses = await Promise.all([
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'concurrent-same-key'),
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'concurrent-same-key'),
    ]);

    expect(responses[1]).toEqual(responses[0]);
    expect(responses[0]).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 300 });
    const receipts = await dataSource!.query(
      'SELECT idempotency_key FROM study_session_transition_receipts WHERE user_id = ? AND idempotency_key = ?',
      [userId, 'concurrent-same-key'],
    );
    expect(receipts).toHaveLength(1);
  });

  it('rejects a terminal session with a stable transition problem', async () => {
    await dataSource!.getRepository(StudySession).update(studySessionId, { state: 'completed' });

    await expectConflictType(
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'terminal-pause'),
      'https://wise.app/errors/study-session-transition-not-allowed',
    );
  });
});
