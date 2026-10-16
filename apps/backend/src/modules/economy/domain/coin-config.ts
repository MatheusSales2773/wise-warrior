/**
 * Minutos de foco válido por Moeda (ADR-012, padrão 2), lido do ambiente a cada chamada como os parâmetros de XP.
 * Ausente, inválido ou fracionário que viraria zero cai no padrão, para não dividir por zero.
 */
export function getCoinsPerFocusMinutesDivisor(): number {
  const divisor = Math.floor(Number(process.env.COINS_PER_FOCUS_MINUTES_DIVISOR));
  return Number.isFinite(divisor) && divisor >= 1 ? divisor : 2;
}
