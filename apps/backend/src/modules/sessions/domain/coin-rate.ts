import { getCoinsPerFocusMinutesDivisor } from '../../economy/domain/coin-config';
import { MIN_FOCUS_SECONDS_FOR_XP } from './xp-rate';

/**
 * Moedas de uma Study Session pelo foco válido (ADR-012): `floor(minutosCompletos / COINS_PER_FOCUS_MINUTES_DIVISOR)`.
 * Abaixo do mínimo de foco válido que rende XP, zero. O foco já vem truncado pelo antifraude (ADR-011).
 */
export function coinsForDuration(validSeconds: number): number {
  if (validSeconds < MIN_FOCUS_SECONDS_FOR_XP) return 0;
  return Math.floor(Math.floor(validSeconds / 60) / getCoinsPerFocusMinutesDivisor());
}
