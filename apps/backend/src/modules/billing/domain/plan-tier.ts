import type { PlanTier } from '../../users/entities/user.entity';

/** Status de uma Assinatura do Stripe que dão `plan_tier = premium` (S2.5). `past_due` conta: o Stripe ainda tenta cobrar. */
const PREMIUM_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/**
 * O `plan_tier` que um status do Stripe dá ao usuário. Qualquer outro status (`canceled`, `unpaid`, `incomplete`,
 * `incomplete_expired`, `paused`, um status que o Stripe crie depois) e a falta de Assinatura (`null`) dão `free`.
 */
export function planTierForStatus(status: string | null): PlanTier {
  return status !== null && PREMIUM_STATUSES.has(status) ? 'premium' : 'free';
}
