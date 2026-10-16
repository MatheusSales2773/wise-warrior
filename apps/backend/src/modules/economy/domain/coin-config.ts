/**
 * Minutos de foco válido por Moeda (ADR-012, padrão 2), lido do ambiente a cada chamada como os parâmetros de XP.
 * Ausente, inválido ou fracionário que viraria zero cai no padrão, para não dividir por zero.
 */
export function getCoinsPerFocusMinutesDivisor(): number {
  const divisor = Math.floor(Number(process.env.COINS_PER_FOCUS_MINUTES_DIVISOR));
  return Number.isFinite(divisor) && divisor >= 1 ? divisor : 2;
}

/** Moedas de boas-vindas (ADR-012): o cadastro credita este valor, e a migration o credita uma vez às contas existentes. */
export const SIGNUP_COINS = 90;

/** Moedas da Recompensa de Raid quando `RAID_WIN_COINS` não está definido (ADR-012). */
export const DEFAULT_RAID_WIN_COINS = 50;

/**
 * Moedas da Recompensa de Raid por Participante com Contribuição (ADR-012, padrão 50), lido do ambiente a cada
 * chamada como o divisor. Ausente, inválido ou negativo cai no padrão.
 */
export function getRaidWinCoins(): number {
  const raw = process.env.RAID_WIN_COINS?.trim();
  const coins = raw ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(coins) && coins >= 0 ? coins : DEFAULT_RAID_WIN_COINS;
}
