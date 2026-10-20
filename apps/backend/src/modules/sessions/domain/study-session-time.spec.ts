import {
  applyStudySessionComplete,
  applyStudySessionStop,
  applyStudySessionTransition,
  getStudySessionTime,
  StudySessionTransitionPolicyError,
} from './study-session-time';
import type { StudySessionTerminalReason } from '../entities/study-session.entity';
import type { CappedReason } from './session-validator';

const completionStart = new Date('2026-09-22T12:00:00.000Z');

describe('Study Session pause and resume timing', () => {
  const start = new Date('2026-09-22T12:00:00.000Z');
  const session = () => ({
    startedAt: start,
    plannedDurationSeconds: 1800,
    state: 'running' as const,
    runDeadlineAt: new Date(start.getTime() + 1_800_000),
    pausedAt: null as Date | null,
    pausedTotalSeconds: 0,
    pausedTotalMilliseconds: 0,
    durationValidSeconds: 0,
    version: 1,
    endedAt: null as Date | null,
    terminalReason: null as StudySessionTerminalReason | null,
    xpAwarded: 0,
  });

  it('freezes the remaining focus and excludes every paused interval across repeated cycles', () => {
    const studySession = session();

    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 300_000));
    expect(getStudySessionTime(studySession, new Date(start.getTime() + 300_000))).toEqual({
      remainingSeconds: 1500,
      durationValidSeconds: 300,
      pausedTotalSeconds: 0,
    });

    applyStudySessionTransition(studySession, 'resume', new Date(start.getTime() + 900_000));
    expect(studySession.runDeadlineAt).toEqual(new Date(start.getTime() + 2_400_000));
    expect(studySession).toMatchObject({ state: 'running', pausedAt: null, pausedTotalSeconds: 600, durationValidSeconds: 300, version: 3 });

    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 1_200_000));
    expect(getStudySessionTime(studySession, new Date(start.getTime() + 1_200_000))).toEqual({
      remainingSeconds: 1200,
      durationValidSeconds: 600,
      pausedTotalSeconds: 600,
    });

    applyStudySessionTransition(studySession, 'resume', new Date(start.getTime() + 1_620_000));
    expect(studySession.runDeadlineAt).toEqual(new Date(start.getTime() + 2_820_000));
    expect(studySession).toMatchObject({ state: 'running', pausedAt: null, pausedTotalSeconds: 1020, durationValidSeconds: 600, version: 5 });
    expect(getStudySessionTime(studySession, new Date(start.getTime() + 1_680_000))).toEqual({
      remainingSeconds: 1140,
      durationValidSeconds: 660,
      pausedTotalSeconds: 1020,
    });
  });

  it('keeps the timer and valid focus frozen while a session remains paused', () => {
    const studySession = session();
    const pausedAt = new Date(start.getTime() + 300_000);
    applyStudySessionTransition(studySession, 'pause', pausedAt);

    expect(getStudySessionTime(studySession, new Date(pausedAt.getTime() + 86_400_000))).toEqual({
      remainingSeconds: 1500,
      durationValidSeconds: 300,
      pausedTotalSeconds: 86_400,
    });
  });

  it('rejects pause after the canonical deadline without changing the session', () => {
    const studySession = session();
    const before = { ...studySession };

    expect(() => applyStudySessionTransition(studySession, 'pause', studySession.runDeadlineAt!)).toThrow(
      new StudySessionTransitionPolicyError('deadline-passed'),
    );
    expect(studySession).toEqual(before);
  });

  it('rejects a transition that does not match the current state', () => {
    const studySession = session();
    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 300_000));

    expect(() => applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 301_000))).toThrow(
      new StudySessionTransitionPolicyError('invalid-state'),
    );
    expect(studySession.version).toBe(2);
  });

  it('rejects resuming a running session without mutating its confirmed state', () => {
    const studySession = session();
    const before = { ...studySession };

    expect(() => applyStudySessionTransition(studySession, 'resume', new Date(start.getTime() + 1_000))).toThrow(
      new StudySessionTransitionPolicyError('invalid-state'),
    );
    expect(studySession).toEqual(before);
  });

  it('cancels with zero valid focus seconds without throwing', () => {
    const cancelled = session();

    expect(applyStudySessionStop(cancelled, new Date(start.getTime() + 500))).toEqual({
      state: 'cancelled', durationValidSeconds: 0, xpAwarded: 0, cappedReason: null,
    });
  });

  it('cancels 299 valid seconds without XP and stops at 300 with complete-minute XP', () => {
    const cancelled = session();
    const stoppedEarly = session();

    expect(applyStudySessionStop(cancelled, new Date(start.getTime() + 299_999))).toEqual({
      state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0, cappedReason: null,
    });
    expect(applyStudySessionStop(stoppedEarly, new Date(start.getTime() + 300_000))).toEqual({
      state: 'stopped_early', durationValidSeconds: 300, xpAwarded: 50, cappedReason: null,
    });
    expect(cancelled).toMatchObject({ endedAt: new Date(start.getTime() + 299_999), terminalReason: 'manual-stop', version: 2 });
  });

  it('does not round incomplete focus minutes up when awarding early-stop XP', () => {
    const studySession = session();

    expect(applyStudySessionStop(studySession, new Date(start.getTime() + 359_999))).toEqual({
      state: 'stopped_early', durationValidSeconds: 359, xpAwarded: 50, cappedReason: null,
    });
  });

  it('excludes multiple paused intervals and freezes the total when stopped while paused', () => {
    const studySession = session();
    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 300_250));
    applyStudySessionTransition(studySession, 'resume', new Date(start.getTime() + 600_500));
    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 900_750));

    const stopped = applyStudySessionStop(studySession, new Date(start.getTime() + 1_500_000));

    expect(stopped).toEqual({ state: 'stopped_early', durationValidSeconds: 600, xpAwarded: 100, cappedReason: null });
    expect(studySession).toMatchObject({
      state: 'stopped_early', pausedAt: null, pausedTotalMilliseconds: 899_500,
      pausedTotalSeconds: 899, durationValidSeconds: 600, version: 5,
    });
  });

  it('rejects stopping at the full deadline and leaves the session unchanged', () => {
    const studySession = session();
    const before = { ...studySession };

    expect(() => applyStudySessionStop(studySession, studySession.runDeadlineAt!)).toThrow(
      new StudySessionTransitionPolicyError('deadline-passed'),
    );
    expect(studySession).toEqual(before);
  });
});

describe('Study Session automatic completion timing', () => {
  const plannedSession = (plannedDurationSeconds: number) => ({
    ...sessionForCompletion(),
    plannedDurationSeconds,
    runDeadlineAt: new Date(completionStart.getTime() + plannedDurationSeconds * 1000),
  });

  it('rejects one millisecond before the deadline without mutating the session', () => {
    const studySession = plannedSession(1500);
    const before = { ...studySession };

    expect(() => applyStudySessionComplete(
      studySession,
      new Date(studySession.runDeadlineAt!.getTime() - 1),
      0,
    )).toThrow(new StudySessionTransitionPolicyError('completion-too-early'));
    expect(studySession).toEqual(before);
  });

  it.each([
    [900, 150],
    [1500, 250],
    [3000, 500],
  ])('completes the %i second preset for %i XP at the exact deadline', (plannedDurationSeconds, xpAwarded) => {
    const studySession = plannedSession(plannedDurationSeconds);
    const endedAt = studySession.runDeadlineAt!;

    expect(applyStudySessionComplete(studySession, endedAt, 0)).toEqual({
      state: 'completed',
      durationValidSeconds: plannedDurationSeconds,
      xpAwarded,
      cappedReason: null,
    });
    expect(studySession).toMatchObject({
      state: 'completed',
      durationValidSeconds: plannedDurationSeconds,
      xpAwarded,
      endedAt,
      pausedAt: null,
      terminalReason: 'auto-complete',
      discardedReason: null,
      version: 2,
    });
  });

  it('completes one millisecond after the canonical deadline without exceeding planned focus or XP', () => {
    const studySession = plannedSession(900);
    const deadline = studySession.runDeadlineAt!;

    expect(applyStudySessionComplete(studySession, new Date(deadline.getTime() + 1), 0)).toEqual({
      state: 'completed', durationValidSeconds: 900, xpAwarded: 150, cappedReason: null,
    });
    expect(studySession.endedAt).toEqual(deadline);
  });

  it('keeps terminal sessions immutable under later stop and completion commands', () => {
    const studySession = plannedSession(900);
    applyStudySessionComplete(studySession, studySession.runDeadlineAt!, 0);
    const completed = { ...studySession };

    expect(() => applyStudySessionStop(studySession, new Date(studySession.runDeadlineAt!.getTime() + 1_000))).toThrow(
      new StudySessionTransitionPolicyError('invalid-state'),
    );
    expect(() => applyStudySessionComplete(studySession, new Date(studySession.runDeadlineAt!.getTime() + 1_000), 0)).toThrow(
      new StudySessionTransitionPolicyError('invalid-state'),
    );
    expect(studySession).toEqual(completed);
  });

  it('caps delayed confirmation at the planned focus duration and ends it at the deadline', () => {
    const studySession = plannedSession(1500);
    const deadline = studySession.runDeadlineAt!;

    const result = applyStudySessionComplete(studySession, new Date(deadline.getTime() + 7_200_000), 0);

    expect(result).toMatchObject({ state: 'completed', durationValidSeconds: 1500, xpAwarded: 250 });
    expect(studySession.endedAt).toEqual(deadline);
  });

  it('does not complete paused focus after a long pause and preserves fractional pause milliseconds', () => {
    const studySession = sessionForCompletion();
    const pausedAt = new Date(completionStart.getTime() + 600_250);
    applyStudySessionTransition(studySession, 'pause', pausedAt);

    expect(() => applyStudySessionComplete(
      studySession,
      new Date(pausedAt.getTime() + 86_400_000),
      0,
    )).toThrow(new StudySessionTransitionPolicyError('invalid-state'));

    const resumedAt = new Date(completionStart.getTime() + 1_200_500);
    applyStudySessionTransition(studySession, 'resume', resumedAt);
    const endedAt = new Date(completionStart.getTime() + 2_400_250);
    const result = applyStudySessionComplete(studySession, endedAt, 0);

    expect(result).toMatchObject({ state: 'completed', durationValidSeconds: 1800, xpAwarded: 300 });
    expect(studySession).toMatchObject({ pausedTotalMilliseconds: 600_250, pausedTotalSeconds: 600 });
    expect(getStudySessionTime(studySession, new Date(endedAt.getTime() + 86_400_000))).toEqual({
      remainingSeconds: 0,
      durationValidSeconds: 1800,
      pausedTotalSeconds: 600,
    });
  });

  it('truncates an automatic completion to the remaining daily balance instead of discarding it', () => {
    const studySession = plannedSession(900);
    const endedAt = studySession.runDeadlineAt!;
    const priorDailySeconds = 16 * 3600 - 300;

    expect(applyStudySessionComplete(studySession, endedAt, priorDailySeconds)).toEqual({
      state: 'completed',
      durationValidSeconds: 300,
      xpAwarded: 50,
      cappedReason: 'daily-limit',
    });
    expect(studySession).toMatchObject({
      state: 'completed',
      durationValidSeconds: 300,
      cappedReason: 'daily-limit',
      discardedReason: null,
      terminalReason: 'auto-complete',
    });
  });

  it('awards 125 XP for a 25-minute session when XP_PER_MINUTE is 5', () => {
    process.env.XP_PER_MINUTE = '5';
    try {
      const studySession = plannedSession(1500);
      expect(applyStudySessionComplete(studySession, studySession.runDeadlineAt!, 0)).toMatchObject({
        durationValidSeconds: 1500, xpAwarded: 125, cappedReason: null,
      });
    } finally {
      delete process.env.XP_PER_MINUTE;
    }
  });

  it('cancels an automatic completion truncated below five minutes, with no XP', () => {
    const studySession = plannedSession(900);
    const endedAt = studySession.runDeadlineAt!;

    expect(applyStudySessionComplete(studySession, endedAt, 16 * 3600 - 200)).toEqual({
      state: 'cancelled', durationValidSeconds: 200, xpAwarded: 0, cappedReason: 'daily-limit',
    });
    expect(studySession).toMatchObject({ state: 'cancelled', xpAwarded: 0, terminalReason: 'auto-complete' });
  });

  it('truncates a manual stop to the remaining daily balance', () => {
    const studySession = plannedSession(1800);
    const stopped = applyStudySessionStop(studySession, new Date(completionStart.getTime() + 600_000), 16 * 3600 - 420);

    expect(stopped).toEqual({
      state: 'stopped_early', durationValidSeconds: 420, xpAwarded: 70, cappedReason: 'daily-limit',
    });
    expect(studySession.cappedReason).toBe('daily-limit');
  });

  it('cancels a manual stop whose daily balance leaves under five minutes', () => {
    const studySession = plannedSession(1800);
    const stopped = applyStudySessionStop(studySession, new Date(completionStart.getTime() + 600_000), 16 * 3600 - 120);

    expect(stopped).toMatchObject({ state: 'cancelled', durationValidSeconds: 120, xpAwarded: 0, cappedReason: 'daily-limit' });
  });
});

function sessionForCompletion() {
  return {
    startedAt: completionStart,
    plannedDurationSeconds: 1800,
    state: 'running' as const,
    runDeadlineAt: new Date(completionStart.getTime() + 1_800_000),
    pausedAt: null as Date | null,
    pausedTotalSeconds: 0,
    pausedTotalMilliseconds: 0,
    durationValidSeconds: 0,
    version: 1,
    endedAt: null as Date | null,
    terminalReason: null as StudySessionTerminalReason | null,
    xpAwarded: 0,
    discardedReason: null as string | null,
    cappedReason: null as CappedReason | null,
  };
}
