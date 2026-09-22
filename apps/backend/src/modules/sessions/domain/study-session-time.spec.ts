import { applyStudySessionTransition, getStudySessionTime, StudySessionTransitionPolicyError } from './study-session-time';

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
});
