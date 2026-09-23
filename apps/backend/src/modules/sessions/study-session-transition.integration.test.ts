import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Character } from '../progression/entities/character.entity';
import { MAX_SUPPORTED_XP_TOTAL } from '../progression/domain/progression-policy';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
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

describe('Study Session transitions against MySQL', () => {
  jest.setTimeout(30_000);
  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let service: StudySessionTransitionService;
  let progression: ProgressionService;
  let realtime: { emitToUser: jest.Mock };
  let now: Date;
  const userId = '00000000-0000-4000-8000-000000000071';
  const authSessionId = '00000000-0000-4000-8000-000000000072';
  const studySessionId = '00000000-0000-4000-8000-000000000073';
  const characterId = '00000000-0000-4000-8000-000000000075';

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_study_transition');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({ id: userId, email: 'pause@example.com', passwordHash: 'hash', displayName: 'Pause', planTier: 'free' });
    await dataSource.getRepository(Character).insert({ id: characterId, userId, level: 1, xpTotal: 0 });

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
    realtime = { emitToUser: jest.fn() };
    progression = new ProgressionService(dataSource.getRepository(Character), realtime as unknown as RealtimeGateway);
    service = new StudySessionTransitionService(dataSource, { now: () => new Date(now) }, progression);
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

  it('cancels at 299 valid seconds with zero XP and keeps the audit record', async () => {
    now = new Date(now.getTime() + 299_999);

    const result = await service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'cancel-at-299');

    expect(result).toMatchObject({
      state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0,
      remainingSeconds: 0, version: 2, terminalReason: 'manual-stop',
    });
    expect(result.endedAt).toEqual(now);
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0, version: 2 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 0 });
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('awards one proportional reward at 300 seconds and returns the same receipt on retry', async () => {
    now = new Date(now.getTime() + 300_000);

    const result = await service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-at-300');
    now = new Date(now.getTime() + 5_000);
    const replay = await service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-at-300');

    expect(result).toMatchObject({ state: 'stopped_early', durationValidSeconds: 300, xpAwarded: 50, remainingSeconds: 0, version: 2 });
    expect(replay).toEqual(result);
    await expectConflictType(
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 2 }, 'stop-at-300'),
      'https://wise.app/errors/idempotency-key-reused',
    );
    await expectConflictType(
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-stale-version'),
      'https://wise.app/errors/study-session-version-conflict',
    );
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 50 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT action FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toEqual([
      { action: 'stop' },
    ]);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(realtime.emitToUser).toHaveBeenCalledWith(userId, 'progress:xpUpdated', {
      xpGained: 50, xpTotal: 50, level: 1,
    });
  });

  it('freezes valid focus and pause totals when stopped from a repeatedly paused session', async () => {
    now = new Date(now.getTime() + 200_000);
    await service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'pause-first');
    now = new Date(now.getTime() + 600_000);
    await service.resume(userId, authSessionId, studySessionId, { expectedVersion: 2 }, 'resume-first');
    now = new Date(now.getTime() + 100_000);
    await service.pause(userId, authSessionId, studySessionId, { expectedVersion: 3 }, 'pause-second');
    now = new Date(now.getTime() + 300_000);

    const result = await service.stop(userId, authSessionId, studySessionId, { expectedVersion: 4 }, 'stop-paused');

    expect(result).toMatchObject({
      state: 'stopped_early', durationValidSeconds: 300, pausedTotalSeconds: 900,
      remainingSeconds: 0, xpAwarded: 50, version: 5,
    });
    expect(result.pausedAt).toBeNull();
  });

  it('rolls back the session, active reference and receipt when progression cannot grant XP', async () => {
    await dataSource!.getRepository(Character).update(characterId, { xpTotal: MAX_SUPPORTED_XP_TOTAL });
    now = new Date(now.getTime() + 300_000);

    await expect(service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-overflow'))
      .rejects.toThrow('total de XP excede o limite suportado');

    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'running', version: 1, durationValidSeconds: 0, xpAwarded: 0, endedAt: null });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId }))
      .toMatchObject({ xpTotal: MAX_SUPPORTED_XP_TOTAL });
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('rejects stop at the full deadline without changing the active session', async () => {
    now = new Date(now.getTime() + 1_800_000);

    await expectConflictType(
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-at-deadline'),
      'https://wise.app/errors/study-session-deadline-passed',
    );

    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'running', version: 1, xpAwarded: 0, endedAt: null });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('serializes concurrent stop retries into one terminal snapshot and one XP grant', async () => {
    now = new Date(now.getTime() + 300_000);

    const results = await Promise.all([
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-concurrent'),
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'stop-concurrent'),
    ]);

    expect(results[1]).toEqual(results[0]);
    expect(results[0]).toMatchObject({ state: 'stopped_early', xpAwarded: 50, version: 2 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 50 });
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(1);
  });

  it('rejects a terminal session with a stable transition problem', async () => {
    await dataSource!.getRepository(StudySession).update(studySessionId, { state: 'completed' });

    await expectConflictType(
      service.pause(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'terminal-pause'),
      'https://wise.app/errors/study-session-transition-not-allowed',
    );
  });

  it('rejects stop from another authenticated Session and from a terminal state', async () => {
    await expectConflictType(
      service.stop(userId, 'another-device', studySessionId, { expectedVersion: 1 }, 'wrong-device-stop'),
      'https://wise.app/errors/study-session-not-controllable',
    );
    await dataSource!.getRepository(StudySession).update(studySessionId, { state: 'completed' });
    await expectConflictType(
      service.stop(userId, authSessionId, studySessionId, { expectedVersion: 1 }, 'terminal-stop'),
      'https://wise.app/errors/study-session-transition-not-allowed',
    );
  });
});
