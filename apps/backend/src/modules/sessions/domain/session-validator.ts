/**
 * Regra de negócio antifraude (PRD seção 7.3 — RN-ANTIFRAUDE). Camada de
 * Domínio, sem I/O: recebe timestamps já gerados pelo servidor (nunca o
 * cliente) e a soma diária prévia do usuário, e trunca o foco válido nos limites.
 */

import { getMaxContinuousSessionSeconds, getMaxDailySeconds } from './economy-config';

/** Sessões que passam do limite são truncadas, não descartadas (ADR-011). */
export type CappedReason = 'continuous-limit' | 'daily-limit';

export interface SessionValidationInput {
  startedAt: Date;
  endedAt: Date;
  /** Soma de duração válida já registrada hoje para este usuário, antes desta sessão. */
  priorDailySeconds: number;
}

export interface SessionValidationResult {
  durationSeconds: number;
  validSeconds: number;
  cappedReason: CappedReason | null;
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

  let validSeconds = durationSeconds;
  let cappedReason: CappedReason | null = null;

  const continuousLimit = getMaxContinuousSessionSeconds();
  if (validSeconds > continuousLimit) {
    validSeconds = continuousLimit;
    cappedReason = 'continuous-limit';
  }

  const dailyBalance = Math.max(0, getMaxDailySeconds() - priorDailySeconds);
  if (validSeconds > dailyBalance) {
    validSeconds = dailyBalance;
    cappedReason = 'daily-limit';
  }

  return { durationSeconds, validSeconds, cappedReason };
}
