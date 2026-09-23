import { ConflictException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Character } from '../progression/entities/character.entity';
import { MAX_SUPPORTED_XP_TOTAL } from '../progression/domain/progression-policy';
import { ProgressionService } from '../progression/progression.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { StudySession } from './entities/study-session.entity';
import { StudySessionStartService } from './study-session-start.service';
import { StudySessionTransitionService, type StudySessionTransitionContext } from './study-session-transition.service';
import type { StudySessionCommandAction } from './domain/study-session-time';
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
  const transition = (
    action: StudySessionCommandAction,
    expectedVersion: number,
    idempotencyKey: string,
    overrides: Partial<StudySessionTransitionContext> = {},
  ) => service[action]({
    userId,
    authSessionId,
    studySessionId,
    dto: { expectedVersion },
    idempotencyKey,
    ...overrides,
  });

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
    const paused = await transition('pause', 1, 'pause-once');

    expect(paused).toMatchObject({ state: 'paused', remainingSeconds: 1500, durationValidSeconds: 300, pausedTotalSeconds: 0, version: 2 });
    expect(paused.serverNow).toEqual(now);

    now = new Date(now.getTime() + 600_000);
    const resumed = await transition('resume', 2, 'resume-once');

    expect(resumed).toMatchObject({ state: 'running', remainingSeconds: 1500, durationValidSeconds: 300, pausedTotalSeconds: 600, version: 3, xpAwarded: 0 });
    expect(resumed.runDeadlineAt).toEqual(new Date('2026-09-22T12:40:00.000Z'));
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'running', durationValidSeconds: 300, pausedTotalSeconds: 600, version: 3, xpAwarded: 0 });
  });

  it('returns the original receipt for retries and rejects stale versions and key reuse', async () => {
    now = new Date(now.getTime() + 300_000);
    const paused = await transition('pause', 1, 'pause-once');
    now = new Date(now.getTime() + 60_000);

    const replay = await transition('pause', 1, 'pause-once');
    expect(replay).toEqual(paused);
    await expectConflictType(
      transition('resume', 1, 'stale-resume'),
      'https://wise.app/errors/study-session-version-conflict',
    );
    await expectConflictType(
      transition('resume', 1, 'pause-once'),
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
      transition('pause', 1, 'pause-once', { studySessionId: anotherStudySessionId }),
      'https://wise.app/errors/idempotency-key-reused',
    );

    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 300, xpAwarded: 0 });
  });

  it('serializes concurrent pause commands so exactly one version change wins', async () => {
    now = new Date(now.getTime() + 300_000);
    const results = await Promise.allSettled([
      transition('pause', 1, 'pause-first'),
      transition('pause', 1, 'pause-second'),
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
      transition('pause', 1, 'concurrent-same-key'),
      transition('pause', 1, 'concurrent-same-key'),
    ]);

    expect(responses[1]).toEqual(responses[0]);
    expect(responses[0]).toMatchObject({ state: 'paused', version: 2, durationValidSeconds: 300 });
    const receipts = await dataSource!.query(
      'SELECT idempotency_key FROM study_session_transition_receipts WHERE user_id = ? AND idempotency_key = ?',
      [userId, 'concurrent-same-key'],
    );
    expect(receipts).toHaveLength(1);
  });

  it('replays a transition snapshot after later transitions without refreshing its original fields', async () => {
    now = new Date(now.getTime() + 300_000);
    const paused = await transition('pause', 1, 'pause-before-resume');
    now = new Date(now.getTime() + 60_000);
    const resumed = await transition('resume', 2, 'resume-after-pause');
    now = new Date(now.getTime() + 5_000);

    await expect(transition('pause', 1, 'pause-before-resume')).resolves.toEqual(paused);
    expect(paused.serverNow).not.toEqual(resumed.serverNow);
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'running', version: 3, durationValidSeconds: 360 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId }))
      .toMatchObject({ xpTotal: 0 });
  });

  it('rejects an early automatic completion, then atomically completes and replays the terminal snapshot', async () => {
    const deadline = new Date(now.getTime() + 1_500_000);
    await dataSource!.getRepository(StudySession).update(studySessionId, {
      plannedDurationSeconds: 1500,
      runDeadlineAt: deadline,
    });

    now = new Date(deadline.getTime() - 1);
    await expectConflictType(
      transition('complete', 1, 'complete-exactly-once'),
      'https://wise.app/errors/study-session-completion-too-early',
    );
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'running', version: 1, durationValidSeconds: 0, xpAwarded: 0, endedAt: null });
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId]))
      .toHaveLength(0);

    now = deadline;
    const completed = await transition('complete', 1, 'complete-exactly-once');
    const committedSession = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(completed).toMatchObject({
      state: 'completed', durationValidSeconds: 1500, xpAwarded: 250,
      terminalReason: 'auto-complete', discardedReason: null, remainingSeconds: 0, version: 2,
    });
    expect(completed.endedAt).toEqual(deadline);
    expect(committedSession).toMatchObject({
      state: 'completed', durationValidSeconds: 1500, xpAwarded: 250,
      terminalReason: 'auto-complete', version: 2,
    });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 250 });
    expect(await dataSource!.query('SELECT action FROM study_session_transition_receipts WHERE user_id = ?', [userId]))
      .toEqual([{ action: 'complete' }]);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(realtime.emitToUser).toHaveBeenCalledWith(userId, 'progress:xpUpdated', {
      xpGained: 250, xpTotal: 250, level: 1,
    });

    now = new Date(deadline.getTime() + 60_000);
    await expect(transition('complete', 1, 'complete-exactly-once')).resolves.toEqual(completed);
    await expectConflictType(
      transition('complete', 2, 'complete-exactly-once'),
      'https://wise.app/errors/idempotency-key-reused',
    );
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 250 });
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent automatic completions to one reward and one stale-version conflict', async () => {
    const deadline = new Date(now.getTime() + 900_000);
    await dataSource!.getRepository(StudySession).update(studySessionId, {
      plannedDurationSeconds: 900,
      runDeadlineAt: deadline,
    });
    now = deadline;

    const results = await Promise.allSettled([
      transition('complete', 1, 'complete-concurrent-a'),
      transition('complete', 1, 'complete-concurrent-b'),
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
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'completed', durationValidSeconds: 900, xpAwarded: 150, version: 2 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 150 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
  });

  it('serializes stop against automatic completion at the canonical deadline', async () => {
    const deadline = new Date(now.getTime() + 900_000);
    await dataSource!.getRepository(StudySession).update(studySessionId, {
      plannedDurationSeconds: 900,
      runDeadlineAt: deadline,
    });
    now = deadline;

    const results = await Promise.allSettled([
      transition('stop', 1, 'stop-at-completion-boundary'),
      transition('complete', 1, 'complete-at-stop-boundary'),
    ]);

    const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.complete>>> => result.status === 'fulfilled');
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]!.value).toMatchObject({ state: 'completed', durationValidSeconds: 900, xpAwarded: 150, version: 2 });
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    const rejectionType = (rejected!.reason as ConflictException).getResponse() as { type: string };
    expect([
      'https://wise.app/errors/study-session-deadline-passed',
      'https://wise.app/errors/study-session-version-conflict',
    ]).toContain(rejectionType.type);
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'completed', durationValidSeconds: 900, xpAwarded: 150, version: 2 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 150 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
  });

  it('discards completion over the daily focus limit without XP or progress events', async () => {
    const deadline = new Date(now.getTime() + 900_000);
    await dataSource!.getRepository(StudySession).update(studySessionId, {
      plannedDurationSeconds: 900,
      runDeadlineAt: deadline,
    });
    await dataSource!.getRepository(StudySession).insert({
      id: '00000000-0000-4000-8000-000000000074',
      userId,
      subject: null,
      mode: 'solo',
      raidId: null,
      startedAt: new Date(now.getTime() - 900_000),
      endedAt: now,
      plannedDurationSeconds: 900,
      state: 'completed',
      runDeadlineAt: now,
      pausedAt: null,
      pausedTotalSeconds: 0,
      pausedTotalMilliseconds: 0,
      version: 2,
      terminalReason: 'auto-complete',
      initiatingSessionId: authSessionId,
      durationValidSeconds: 57_000,
      xpAwarded: 0,
      discardedReason: null,
    });
    now = deadline;

    const result = await transition('complete', 1, 'complete-daily-limit');

    expect(result).toMatchObject({
      state: 'discarded', durationValidSeconds: 0, xpAwarded: 0,
      discardedReason: 'daily-limit-exceeded', terminalReason: 'auto-complete', version: 2,
    });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 0 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('cancels at 299 valid seconds with zero XP and keeps the audit record', async () => {
    now = new Date(now.getTime() + 299_999);

    const result = await transition('stop', 1, 'cancel-at-299');

    expect(result).toMatchObject({
      state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0,
      remainingSeconds: 0, version: 2, terminalReason: 'manual-stop',
    });
    expect(result.endedAt).toEqual(now);
    const persisted = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    expect(persisted).toMatchObject({ state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0, version: 2 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM raid_contributions WHERE study_session_id = ?', [studySessionId])).toHaveLength(0);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 0 });
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('awards one proportional reward at 300 seconds and returns the same receipt on retry', async () => {
    now = new Date(now.getTime() + 300_000);
    const runTransaction = dataSource!.transaction.bind(dataSource!) as (
      callback: (manager: EntityManager) => Promise<unknown>,
    ) => Promise<unknown>;
    const transactionSpy = jest.spyOn(dataSource!, 'transaction').mockImplementation(
      (async (callback: (manager: EntityManager) => Promise<unknown>) => runTransaction(async (manager) => {
        const result = await callback(manager);
        expect(realtime.emitToUser).not.toHaveBeenCalled();
        return result;
      })) as never,
    );

    const result = await transition('stop', 1, 'stop-at-300');
    transactionSpy.mockRestore();
    const stoppedAt = now;
    now = new Date(now.getTime() + 5_000);
    const replay = await transition('stop', 1, 'stop-at-300');

    expect(result).toMatchObject({ state: 'stopped_early', durationValidSeconds: 300, xpAwarded: 50, remainingSeconds: 0, version: 2 });
    expect(replay).toEqual(result);
    await expectConflictType(
      transition('stop', 2, 'stop-at-300'),
      'https://wise.app/errors/idempotency-key-reused',
    );
    await expectConflictType(
      transition('stop', 1, 'stop-stale-version'),
      'https://wise.app/errors/study-session-version-conflict',
    );
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 50 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM raid_contributions WHERE study_session_id = ?', [studySessionId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT action FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toEqual([
      { action: 'stop' },
    ]);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(realtime.emitToUser).toHaveBeenCalledWith(userId, 'progress:xpUpdated', {
      xpGained: 50, xpTotal: 50, level: 1,
    });

    const startService = new StudySessionStartService(
      dataSource!, new UsersService({} as never, {} as never, {} as never, {} as never),
    );
    const nextSession = await startService.start(userId, authSessionId, { plannedDurationSeconds: 900 }, 'start-after-stop');
    expect(nextSession).toMatchObject({ state: 'running', mode: 'solo', subject: null, canControl: true });
    expect(await startService.active(userId, authSessionId)).toMatchObject({ id: nextSession.id, state: 'running' });
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'stopped_early', endedAt: stoppedAt, xpAwarded: 50 });
  });

  it('freezes valid focus and pause totals when stopped from a repeatedly paused session', async () => {
    now = new Date(now.getTime() + 200_000);
    await transition('pause', 1, 'pause-first');
    now = new Date(now.getTime() + 600_000);
    await transition('resume', 2, 'resume-first');
    now = new Date(now.getTime() + 100_000);
    await transition('pause', 3, 'pause-second');
    now = new Date(now.getTime() + 300_000);

    const result = await transition('stop', 4, 'stop-paused');

    expect(result).toMatchObject({
      state: 'stopped_early', durationValidSeconds: 300, pausedTotalSeconds: 900,
      remainingSeconds: 0, xpAwarded: 50, version: 5,
    });
    expect(result.pausedAt).toBeNull();
  });

  it('rolls back the session, active reference and receipt when progression cannot grant XP', async () => {
    const studySessionBefore = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    const characterBefore = await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId });
    await dataSource!.getRepository(Character).update(characterId, { xpTotal: MAX_SUPPORTED_XP_TOTAL });
    const characterAtLimit = await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId });
    now = new Date(now.getTime() + 300_000);

    await expect(transition('stop', 1, 'stop-overflow'))
      .rejects.toThrow('total de XP excede o limite suportado');

    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId })).toEqual(studySessionBefore);
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM study_session_command_keys WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(characterBefore.level).toBe(characterAtLimit.level);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toEqual(characterAtLimit);
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('rolls back automatic completion, XP, active reference and receipt when progression fails', async () => {
    const deadline = new Date(now.getTime() + 900_000);
    await dataSource!.getRepository(StudySession).update(studySessionId, {
      plannedDurationSeconds: 900,
      runDeadlineAt: deadline,
    });
    await dataSource!.getRepository(Character).update(characterId, { xpTotal: MAX_SUPPORTED_XP_TOTAL });
    const studySessionBefore = await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId });
    const characterBefore = await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId });
    now = deadline;

    await expect(transition('complete', 1, 'complete-overflow'))
      .rejects.toThrow('total de XP excede o limite suportado');

    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId })).toEqual(studySessionBefore);
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toEqual(characterBefore);
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM study_session_command_keys WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('rejects stop at the full deadline without changing the active session', async () => {
    now = new Date(now.getTime() + 1_800_000);

    await expectConflictType(
      transition('stop', 1, 'stop-at-deadline'),
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
      transition('stop', 1, 'stop-concurrent'),
      transition('stop', 1, 'stop-concurrent'),
    ]);

    expect(results[1]).toEqual(results[0]);
    expect(results[0]).toMatchObject({ state: 'stopped_early', xpAwarded: 50, version: 2 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 50 });
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(1);
  });

  it('serializes concurrent stops with distinct keys into one terminal result and one XP grant', async () => {
    now = new Date(now.getTime() + 300_000);

    const results = await Promise.allSettled([
      transition('stop', 1, 'stop-unique-a'),
      transition('stop', 1, 'stop-unique-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    expect((rejected!.reason as ConflictException).getResponse()).toMatchObject({
      type: 'https://wise.app/errors/study-session-version-conflict',
    });
    expect(await dataSource!.getRepository(StudySession).findOneByOrFail({ id: studySessionId }))
      .toMatchObject({ state: 'stopped_early', durationValidSeconds: 300, xpAwarded: 50, version: 2 });
    expect(await dataSource!.getRepository(Character).findOneByOrFail({ id: characterId })).toMatchObject({ xpTotal: 50 });
    expect(await dataSource!.query('SELECT * FROM active_study_sessions WHERE user_id = ?', [userId])).toHaveLength(0);
    expect(await dataSource!.query('SELECT * FROM study_session_transition_receipts WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(await dataSource!.query('SELECT * FROM study_session_command_keys WHERE user_id = ?', [userId])).toHaveLength(1);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
  });

  it('rejects a terminal session with a stable transition problem', async () => {
    await dataSource!.getRepository(StudySession).update(studySessionId, { state: 'completed' });

    await expectConflictType(
      transition('pause', 1, 'terminal-pause'),
      'https://wise.app/errors/study-session-transition-not-allowed',
    );
  });

  it('rejects stop from another authenticated Session and from a terminal state', async () => {
    await expectConflictType(
      transition('stop', 1, 'wrong-device-stop', { authSessionId: 'another-device' }),
      'https://wise.app/errors/study-session-not-controllable',
    );
    await dataSource!.getRepository(StudySession).update(studySessionId, { state: 'completed' });
    await expectConflictType(
      transition('stop', 1, 'terminal-stop'),
      'https://wise.app/errors/study-session-transition-not-allowed',
    );
  });
});
