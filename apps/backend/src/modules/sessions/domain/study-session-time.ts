import type { StudySessionState } from '../entities/study-session.entity';
import { xpForDuration } from './xp-rate';

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
  terminalReason?: string | null;
  xpAwarded?: number | null;
};

export type StudySessionTransitionAction = 'pause' | 'resume';
export type StudySessionCommandAction = StudySessionTransitionAction | 'stop';
export type StudySessionTransitionFailure = 'invalid-state' | 'deadline-passed';

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
};

export function getStudySessionTime(session: StudySessionTimeFields, now: Date): StudySessionTime {
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
  const nextState = time.durationValidSeconds < 300 ? 'cancelled' : 'stopped_early';
  const xpAwarded = nextState === 'cancelled' ? 0 : xpForDuration(time.durationValidSeconds);

  session.state = nextState;
  session.endedAt = now;
  session.pausedAt = null;
  session.pausedTotalMilliseconds = pausedTotalMilliseconds;
  session.pausedTotalSeconds = Math.floor(pausedTotalMilliseconds / MILLISECONDS_PER_SECOND);
  session.durationValidSeconds = time.durationValidSeconds;
  session.terminalReason = 'manual-stop';
  session.xpAwarded = xpAwarded;
  session.version = (session.version ?? 1) + 1;

  return { state: nextState, durationValidSeconds: time.durationValidSeconds, xpAwarded };
}

function getRecordedPausedMilliseconds(session: StudySessionTimeFields): number {
  if (session.pausedTotalMilliseconds !== null && session.pausedTotalMilliseconds !== undefined) {
    return Number(session.pausedTotalMilliseconds);
  }
  return (session.pausedTotalSeconds ?? 0) * MILLISECONDS_PER_SECOND;
}
