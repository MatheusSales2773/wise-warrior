import {
  applyStudySessionComplete,
  applyStudySessionStop,
  applyStudySessionTransition,
  getStudySessionTime,
  StudySessionTransitionPolicyError,
} from './study-session-time';
import type { StudySessionTerminalReason } from '../entities/study-session.entity';

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

  it('cancels 299 valid seconds without XP and stops at 300 with complete-minute XP', () => {
    const cancelled = session();
    const stoppedEarly = session();

    expect(applyStudySessionStop(cancelled, new Date(start.getTime() + 299_999))).toEqual({
      state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0,
    });
    expect(applyStudySessionStop(stoppedEarly, new Date(start.getTime() + 300_000))).toEqual({
      state: 'stopped_early', durationValidSeconds: 300, xpAwarded: 50,
    });
    expect(cancelled).toMatchObject({ endedAt: new Date(start.getTime() + 299_999), terminalReason: 'manual-stop', version: 2 });
  });

  it('excludes multiple paused intervals and freezes the total when stopped while paused', () => {
    const studySession = session();
    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 300_250));
    applyStudySessionTransition(studySession, 'resume', new Date(start.getTime() + 600_500));
    applyStudySessionTransition(studySession, 'pause', new Date(start.getTime() + 900_750));

    const stopped = applyStudySessionStop(studySession, new Date(start.getTime() + 1_500_000));

    expect(stopped).toEqual({ state: 'stopped_early', durationValidSeconds: 600, xpAwarded: 100 });
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
      discardedReason: null,
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

  it('caps delayed confirmation at the planned focus duration', () => {
    const studySession = plannedSession(1500);
    const endedAt = new Date(studySession.runDeadlineAt!.getTime() + 7_200_000);

    const result = applyStudySessionComplete(studySession, endedAt, 0);

    expect(result).toMatchObject({ state: 'completed', durationValidSeconds: 1500, xpAwarded: 250 });
    expect(studySession.endedAt).toEqual(endedAt);
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

  it('discards an automatic completion that would exceed the daily eligible focus limit', () => {
    const studySession = plannedSession(900);
    const endedAt = studySession.runDeadlineAt!;

    expect(applyStudySessionComplete(studySession, endedAt, 57_000)).toEqual({
      state: 'discarded',
      durationValidSeconds: 0,
      xpAwarded: 0,
      discardedReason: 'daily-limit-exceeded',
    });
    expect(studySession).toMatchObject({
      state: 'discarded',
      durationValidSeconds: 0,
      xpAwarded: 0,
      discardedReason: 'daily-limit-exceeded',
      terminalReason: 'auto-complete',
    });
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
  };
}
