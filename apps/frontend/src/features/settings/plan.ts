/** "free" → "Free"; the plan name as the server sends it, capitalized. */
export function planName(planTier: string): string {
  return planTier.charAt(0).toUpperCase() + planTier.slice(1);
}

/** "Free · premium em breve": the current plan, with no upgrade to offer yet. */
export function planLabel(planTier: string): string {
  return `${planName(planTier)} · premium em breve`;
}
