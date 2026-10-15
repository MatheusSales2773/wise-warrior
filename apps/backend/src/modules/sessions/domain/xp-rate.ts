import { getXpPerMinute } from './economy-config';

/**
 * Converte foco válido em XP: `XP_PER_MINUTE` (padrão 10, ADR-011) por minuto
 * completo, proporcional a qualquer duração planejada.
 */
export function xpForDuration(validSeconds: number): number {
  if (validSeconds < 0) {
    throw new Error('validSeconds não pode ser negativo');
  }
  return Math.floor(validSeconds / 60) * getXpPerMinute();
}
