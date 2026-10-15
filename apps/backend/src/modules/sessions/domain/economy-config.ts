/**
 * Parâmetros de balanceamento da economia de XP (ADR-011). Lidos do ambiente a
 * cada chamada para que testes e deploys os ajustem sem recompilar; valores
 * ausentes ou inválidos caem no padrão.
 */
function positiveNumberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getXpPerMinute(): number {
  return Math.floor(positiveNumberFromEnv('XP_PER_MINUTE', 10));
}

export function getMaxContinuousSessionSeconds(): number {
  return Math.floor(positiveNumberFromEnv('ANTIFRAUDE_MAX_CONTINUOUS_HOURS', 4) * 3600);
}

export function getMaxDailySeconds(): number {
  return Math.floor(positiveNumberFromEnv('ANTIFRAUDE_MAX_DAILY_HOURS', 16) * 3600);
}
