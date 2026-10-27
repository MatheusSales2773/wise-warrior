import type { StudySessionKind, StudySessionState, StudySessionTerminalReason } from '../entities/study-session.entity';
import { MIN_FOCUS_SECONDS_FOR_XP, xpForDuration } from './xp-rate';
import { validateStudySessionFocusSeconds, type CappedReason } from './session-validator';
import { getMaxContinuousSessionSeconds, getMaxDailySeconds } from './economy-config';

const MILLISECONDS_PER_SECOND = 1000;

export type StudySessionTimeFields = {
  /** Ausente é Ciclo: sessões e recibos anteriores ao Foco livre não têm `kind`. */
  kind?: StudySessionKind | null;
  startedAt: Date;
  plannedDurationSeconds?: number | null;
  state?: StudySessionState | null;
  runDeadlineAt?: Date | null;
  pausedAt?: Date | null;
  pausedTotalSeconds?: number | null;
  pausedTotalMilliseconds?: number | string | null;
  durationValidSeconds?: number | null;
  version?: number | null;
  pauseCount?: number | null;
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
  state: 'completed' | 'cancelled' | 'stopped_early';
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

/**
 * Teto do Foco livre (ADR-011): o limite contínuo e o saldo diário restante, o que acabar primeiro, descontado o foco
 * que a sessão já acumulou. Sem saldo o teto é zero e a sessão não deve começar.
 */
export function freeFocusCeilingSeconds(priorDailySeconds: number, focusedSeconds = 0): number {
  const available = Math.min(
    getMaxContinuousSessionSeconds(),
    Math.max(0, getMaxDailySeconds() - priorDailySeconds),
  );
  return Math.max(0, available - focusedSeconds);
}

export function isFreeFocus(session: Pick<StudySessionTimeFields, 'kind'>): boolean {
  return session.kind === 'free';
}

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
  priorDailySeconds = 0,
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
    session.pauseCount = (session.pauseCount ?? 0) + 1;
    session.version = (session.version ?? 1) + 1;
    return;
  }

  if (session.state !== 'paused' || !session.pausedAt || !session.runDeadlineAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }

  const pausedRemainingMilliseconds = session.runDeadlineAt.getTime() - session.pausedAt.getTime();
  if (pausedRemainingMilliseconds <= 0) {
    throw new StudySessionTransitionPolicyError('deadline-passed');
  }
  // O teto do Foco livre é recalculado ao retomar: o saldo diário pode ter mudado durante a pausa.
  const remainingMilliseconds = isFreeFocus(session)
    ? freeFocusCeilingSeconds(priorDailySeconds, getStudySessionTime(session, session.pausedAt).durationValidSeconds)
      * MILLISECONDS_PER_SECOND
    : pausedRemainingMilliseconds;
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
  const free = isFreeFocus(session);
  if ((!free && !session.plannedDurationSeconds) || !session.runDeadlineAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }
  if (session.state === 'paused' && !session.pausedAt) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }
  if (session.state === 'running' && session.runDeadlineAt.getTime() <= now.getTime()) {
    throw new StudySessionTransitionPolicyError('deadline-passed');
  }

  const time = getStudySessionTime(session, now);
  if (!free && time.durationValidSeconds >= session.plannedDurationSeconds!) {
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
  // Parar um Foco livre é concluí-lo; só o Ciclo tem Encerramento antecipado.
  const nextState = validSeconds < MIN_FOCUS_SECONDS_FOR_XP ? 'cancelled' : free ? 'completed' : 'stopped_early';
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
  const free = isFreeFocus(session);
  if (
    session.state !== 'running'
    || (!free && !session.plannedDurationSeconds)
    || !session.runDeadlineAt
  ) {
    throw new StudySessionTransitionPolicyError('invalid-state');
  }

  if (free) return completeFreeFocusAtCeiling(session, now, priorDailySeconds);

  const planned = session.plannedDurationSeconds!;
  const time = getStudySessionTime(session, now);
  const focusCandidateSeconds = Math.min(planned, time.durationValidSeconds);
  if (
    now.getTime() < session.runDeadlineAt.getTime()
    || focusCandidateSeconds < planned
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
  // The focus ended at the canonical deadline, even when the completion is recorded later.
  session.endedAt = session.runDeadlineAt;
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

/** O teto é o fim canônico do Foco livre; o foco conta até ele, mesmo que a conclusão seja gravada depois. */
function completeFreeFocusAtCeiling(
  session: StudySessionTimeFields,
  now: Date,
  priorDailySeconds: number,
): StudySessionCompletionResult {
  const ceiling = session.runDeadlineAt!;
  if (now.getTime() < ceiling.getTime()) {
    throw new StudySessionTransitionPolicyError('completion-too-early');
  }

  const focusSeconds = getStudySessionTime(session, ceiling).durationValidSeconds;
  const validation = validateStudySessionFocusSeconds(focusSeconds, priorDailySeconds);
  // O teto já respeita os dois limites, então o validador não trunca; o motivo é o limite que o definiu.
  const dailyBalance = Math.max(0, getMaxDailySeconds() - priorDailySeconds);
  const cappedReason: CappedReason | null = validation.cappedReason
    ?? (validation.validSeconds >= dailyBalance
      ? 'daily-limit'
      : validation.validSeconds >= getMaxContinuousSessionSeconds() ? 'continuous-limit' : null);
  const totalPausedMilliseconds = getRecordedPausedMilliseconds(session);
  const result: StudySessionCompletionResult = {
    state: validation.validSeconds < MIN_FOCUS_SECONDS_FOR_XP ? 'cancelled' : 'completed',
    durationValidSeconds: validation.validSeconds,
    xpAwarded: xpForDuration(validation.validSeconds),
    cappedReason,
  };

  session.state = result.state;
  session.endedAt = ceiling;
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
