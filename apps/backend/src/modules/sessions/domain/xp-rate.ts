import { getXpPerMinute } from './economy-config';

/** Menos que isso de foco válido não rende XP nem Contribuição para Raid (Cancelamento). */
export const MIN_FOCUS_SECONDS_FOR_XP = 300;

/**
 * Converte foco válido em XP: `XP_PER_MINUTE` (padrão 10, ADR-011) por minuto
 * completo, proporcional a qualquer duração planejada; abaixo de 5 minutos, zero.
 */
export function xpForDuration(validSeconds: number): number {
  if (validSeconds < 0) {
    throw new Error('validSeconds não pode ser negativo');
  }
  if (validSeconds < MIN_FOCUS_SECONDS_FOR_XP) return 0;
  return Math.floor(validSeconds / 60) * getXpPerMinute();
}
