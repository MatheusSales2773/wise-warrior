/**
 * Regra de negócio antifraude (PRD seção 7.3 — RN-ANTIFRAUDE). Camada de
 * Domínio, sem I/O: recebe timestamps já gerados pelo servidor (nunca o
 * cliente) e a soma diária prévia do usuário, e decide se a sessão é válida.
 */

export const MAX_CONTINUOUS_SESSION_SECONDS = 4 * 60 * 60; // 4h
export const MAX_DAILY_SECONDS = 16 * 60 * 60; // 16h

export type DiscardReason =
  | 'continuous-session-exceeds-limit'
  | 'daily-limit-exceeded';

export interface SessionValidationInput {
  startedAt: Date;
  endedAt: Date;
  /** Soma de duração válida já registrada hoje para este usuário, antes desta sessão. */
  priorDailySeconds: number;
}

export interface SessionValidationResult {
  durationSeconds: number;
  validSeconds: number;
  discardedReason: DiscardReason | null;
}

export function validateSessionDuration(
  input: SessionValidationInput,
): SessionValidationResult {
  const { startedAt, endedAt, priorDailySeconds } = input;
  const durationSeconds = Math.round(
    (endedAt.getTime() - startedAt.getTime()) / 1000,
  );

  if (priorDailySeconds < 0) {
    throw new Error('priorDailySeconds não pode ser negativo');
  }

  return validateFocusSeconds(durationSeconds, priorDailySeconds);
}

/** Validate server-computed focus time without including paused wall time. */
export function validateStudySessionFocusSeconds(
  focusSeconds: number,
  priorDailySeconds: number,
): SessionValidationResult {
  if (!Number.isSafeInteger(focusSeconds) || focusSeconds < 0) {
    throw new Error('focusSeconds deve ser um inteiro não negativo');
  }
  if (!Number.isSafeInteger(priorDailySeconds) || priorDailySeconds < 0) {
    throw new Error('priorDailySeconds deve ser um inteiro não negativo');
  }

  return validateFocusSeconds(focusSeconds, priorDailySeconds);
}

function validateFocusSeconds(
  durationSeconds: number,
  priorDailySeconds: number,
): SessionValidationResult {
  if (durationSeconds <= 0) {
    throw new Error('A duração de foco deve ser maior que zero');
  }

  if (durationSeconds > MAX_CONTINUOUS_SESSION_SECONDS) {
    return {
      durationSeconds,
      validSeconds: 0,
      discardedReason: 'continuous-session-exceeds-limit',
    };
  }

  if (priorDailySeconds + durationSeconds > MAX_DAILY_SECONDS) {
    return {
      durationSeconds,
      validSeconds: 0,
      discardedReason: 'daily-limit-exceeded',
    };
  }

  return { durationSeconds, validSeconds: durationSeconds, discardedReason: null };
}
