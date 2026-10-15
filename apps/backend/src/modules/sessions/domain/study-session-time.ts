import type { StudySessionState, StudySessionTerminalReason } from '../entities/study-session.entity';
import { MIN_FOCUS_SECONDS_FOR_XP, xpForDuration } from './xp-rate';
import { validateStudySessionFocusSeconds, type CappedReason } from './session-validator';

const MILLISECONDS_PER_SECOND = 1000;

export type StudySessionTimeFields = {
  startedAt: Date;
  plannedDurationSeconds?: number | null;
  state?: StudySessionState | null;
  runDeadlineAt?: Date | null;
  pausedAt?: Date | null;
  pausedTotalSeconds?: number | null;
  pausedTotalMilliseconds?: number | string | null;
  durationValidSeconds?: number | null;
  version?: number | null;
  endedAt?: Date | null;
  terminalReason?: StudySessionTerminalReason | null;
  discardedReason?: string | null;
  cappedReason?: CappedReason | null;
  xpAwarded?: number | null;
};

export type StudySessionTransitionAction = 'pause' | 'resume';
export type StudySessionCommandAction = StudySessionTransitionAction | 'stop' | 'complete';
export type StudySessionTransitionFailure = 'invalid-state' | 'deadline-passed' | 'completion-too-early';

export class StudySessionTransitionPolicyError extends Error {
  constructor(readonly reason: StudySessionTransitionFailure) {
    super(reason);
    this.name = 'StudySessionTransitionPolicyError';
  }
}

export type StudySessionTime = {
  remainingSeconds: number;
  durationValidSeconds: number;
  pausedTotalSeconds: number;
};

export type StudySessionStopResult = {
  state: 'cancelled' | 'stopped_early';
  durationValidSeconds: number;
  xpAwarded: number;
  cappedReason: CappedReason | null;
};

export type StudySessionCompletionResult = {
  /** `cancelled` when the antifraude truncation leaves under five minutes of focus. */
  state: 'completed' | 'cancelled';
  durationValidSeconds: number;
  xpAwarded: number;
  cappedReason: CappedReason | null;
};

export function getStudySessionTime(session: StudySessionTimeFields, now: Date): StudySessionTime {
  if (isTerminalStudySessionState(session.state)) {
    const pausedTotalMilliseconds = getRecordedPausedMilliseconds(session);
    return {
      remainingSeconds: 0,
      durationValidSeconds: session.durationValidSeconds ?? 0,
      pausedTotalSeconds: session.pausedTotalSeconds ?? Math.floor(pausedTotalMilliseconds / MILLISECONDS_PER_SECOND),
    };
  }

  const recordedPausedMilliseconds = getRecordedPausedMilliseconds(session);
  const currentPauseMilliseconds = session.state === 'paused' && session.pausedAt
    ? Math.max(0, now.getTime() - session.pausedAt.getTime())
    : 0;
  const totalPausedMilliseconds = recordedPausedMilliseconds + currentPauseMilliseconds;
  const elapsedMilliseconds = Math.max(
    0,
    now.getTime() - session.startedAt.getTime() - totalPausedMilliseconds,
  );
  const plannedSeconds = session.plannedDurationSeconds ?? Number.MAX_SAFE_INTEGER;
  const durationValidSeconds = Math.min(plannedSeconds, Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND));

  let remainingMilliseconds = 0;
  if (session.state === 'paused' && session.pausedAt && session.runDeadlineAt) {
    remainingMilliseconds = session.runDeadlineAt.getTime() - session.pausedAt.getTime();
  } else if (session.state === 'running' && session.runDeadlineAt) {
    remainingMilliseconds = session.runDeadlineAt.getTime() - now.getTime();
  }

  return {
    remainingSeconds: Math.max(0, Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND)),
    durationValidSeconds,
    pausedTotalSeconds: Math.floor(totalPausedMilliseconds / MILLISECONDS_PER_SECOND),
  };
}

export function applyStudySessionTransition(
  session: StudySessionTimeFields,
  action: StudySessionTransitionAction,
  now: Date,
): void {
  if (action === 'pause') {
    if (session.state !== 'running' || !session.runDeadlineAt) {
      throw new StudySessionTransitionPolicyError('invalid-state');
    }
    if (session.runDeadlineAt.getTime() <= now.getTime()) {
      throw new StudySessionTransitionPolicyError('deadline-passed');
    }

    session.pausedAt = now;
    session.state = 'paused';
    session.durationValidSeconds = getStudySessionTime(session, now).durationValidSeconds;
    session.version = (session.version ?? 1) + 1;
    return;
  }

  if (session.state !== 'paused' || !session.pausedAt || !session.runDeadlineAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }

  const remainingMilliseconds = session.runDeadlineAt.getTime() - session.pausedAt.getTime();
  if (remainingMilliseconds <= 0) {
    throw new StudySessionTransitionPolicyError('deadline-passed');
  }

  const pauseDurationMilliseconds = Math.max(0, now.getTime() - session.pausedAt.getTime());
  const totalPausedMilliseconds = getRecordedPausedMilliseconds(session) + pauseDurationMilliseconds;
  session.pausedTotalMilliseconds = totalPausedMilliseconds;
  session.pausedTotalSeconds = Math.floor(totalPausedMilliseconds / MILLISECONDS_PER_SECOND);
  session.runDeadlineAt = new Date(now.getTime() + remainingMilliseconds);
  session.pausedAt = null;
  session.state = 'running';
  session.durationValidSeconds = getStudySessionTime(session, now).durationValidSeconds;
  session.version = (session.version ?? 1) + 1;
}

export function applyStudySessionStop(
  session: StudySessionTimeFields,
  now: Date,
  priorDailySeconds = 0,
): StudySessionStopResult {
  if (session.state !== 'running' && session.state !== 'paused') {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }
  if (!session.plannedDurationSeconds || !session.runDeadlineAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }
  if (session.state === 'paused' && !session.pausedAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }
  if (session.state === 'running' && session.runDeadlineAt.getTime() <= now.getTime()) {
    throw new StudySessionTransitionPolicyError('deadline-passed');
  }

  const time = getStudySessionTime(session, now);
  if (time.durationValidSeconds >= session.plannedDurationSeconds) {
    throw new StudySessionTransitionPolicyError('deadline-passed');
  }

  const currentPauseMilliseconds = session.state === 'paused' && session.pausedAt
    ? Math.max(0, now.getTime() - session.pausedAt.getTime())
    : 0;
  const pausedTotalMilliseconds = getRecordedPausedMilliseconds(session) + currentPauseMilliseconds;
  // Cancelar logo após iniciar deixa 0 s de foco; o validador rejeita duração zero, então não passa por ele.
  const validation = time.durationValidSeconds > 0
    ? validateStudySessionFocusSeconds(time.durationValidSeconds, priorDailySeconds)
    : { validSeconds: 0, cappedReason: null };
  const validSeconds = validation.validSeconds;
  const nextState = validSeconds < MIN_FOCUS_SECONDS_FOR_XP ? 'cancelled' : 'stopped_early';
  const xpAwarded = nextState === 'cancelled' ? 0 : xpForDuration(validSeconds);

  session.state = nextState;
  session.endedAt = now;
  session.pausedAt = null;
  session.pausedTotalMilliseconds = pausedTotalMilliseconds;
  session.pausedTotalSeconds = Math.floor(pausedTotalMilliseconds / MILLISECONDS_PER_SECOND);
  session.durationValidSeconds = validSeconds;
  session.terminalReason = 'manual-stop';
  session.xpAwarded = xpAwarded;
  session.cappedReason = validation.cappedReason;
  session.version = (session.version ?? 1) + 1;

  return {
    state: nextState,
    durationValidSeconds: validSeconds,
    xpAwarded,
    cappedReason: validation.cappedReason,
  };
}

export function applyStudySessionComplete(
  session: StudySessionTimeFields,
  now: Date,
  priorDailySeconds: number,
): StudySessionCompletionResult {
  if (
    session.state !== 'running'
    || !session.plannedDurationSeconds
    || !session.runDeadlineAt
  ) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }

  const time = getStudySessionTime(session, now);
  const focusCandidateSeconds = Math.min(session.plannedDurationSeconds, time.durationValidSeconds);
  if (
    now.getTime() < session.runDeadlineAt.getTime()
    || focusCandidateSeconds < session.plannedDurationSeconds
  ) {
    throw new StudySessionTransitionPolicyError('completion-too-early');
  }

  const validation = validateStudySessionFocusSeconds(focusCandidateSeconds, priorDailySeconds);
  const totalPausedMilliseconds = getRecordedPausedMilliseconds(session);
  const result: StudySessionCompletionResult = {
    state: validation.validSeconds < MIN_FOCUS_SECONDS_FOR_XP ? 'cancelled' : 'completed',
    durationValidSeconds: validation.validSeconds,
    xpAwarded: xpForDuration(validation.validSeconds),
    cappedReason: validation.cappedReason,
  };

  session.state = result.state;
  session.endedAt = now;
  session.pausedAt = null;
  session.pausedTotalMilliseconds = totalPausedMilliseconds;
  session.pausedTotalSeconds = Math.floor(totalPausedMilliseconds / MILLISECONDS_PER_SECOND);
  session.durationValidSeconds = result.durationValidSeconds;
  session.xpAwarded = result.xpAwarded;
  session.terminalReason = 'auto-complete';
  session.cappedReason = result.cappedReason;
  session.version = (session.version ?? 1) + 1;

  return result;
}

function isTerminalStudySessionState(state: StudySessionState | null | undefined): boolean {
  return state === 'completed'
    || state === 'stopped_early'
    || state === 'cancelled'
    || state === 'discarded';
}

function getRecordedPausedMilliseconds(session: StudySessionTimeFields): number {
  if (session.pausedTotalMilliseconds !== null && session.pausedTotalMilliseconds !== undefined) {
    return Number(session.pausedTotalMilliseconds);
  }
  return (session.pausedTotalSeconds ?? 0) * MILLISECONDS_PER_SECOND;
}
