/** A Raid soma o XP das sessões, e o backend dá 10 XP por minuto de foco (`XP_PER_MINUTE`): 600 XP valem uma hora. */
export const XP_PER_FOCUS_HOUR = 600;

const ONE_DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * XP em horas de foco. Totais da Raid acima de 10h aparecem inteiros ("138h"); o resto, e o que cada membro
 * fez (`precise`), com uma casa ("24,2h").
 */
export function formatFocusHours(xp: number, { precise = false }: { precise?: boolean } = {}): string {
  const hours = Math.max(0, xp) / XP_PER_FOCUS_HOUR;
  if (!precise && hours >= 10) return `${WHOLE.format(Math.floor(hours))}h`;
  return `${ONE_DECIMAL.format(Math.floor(hours * 10) / 10)}h`;
}
