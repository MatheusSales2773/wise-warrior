/** "free" → "Free"; the plan name as the server sends it, capitalized. */
export function planName(planTier: string): string {
  return planTier.charAt(0).toUpperCase() + planTier.slice(1);
}

/** "Free · premium em breve" while billing is off (S5.2); just the plan name once it is on (S5.13). */
export function planLabel(planTier: string, available = false): string {
  return available ? planName(planTier) : `${planName(planTier)} · premium em breve`;
}

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** "dd/mm" of an ISO instant, on the São Paulo calendar. */
export function dayMonth(iso: string): string {
  return DAY_MONTH.format(new Date(iso));
}
