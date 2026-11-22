import type { PlanTier } from '../../users/entities/user.entity';
import type { Subscription } from '../entities/subscription.entity';

export interface SubscriptionView {
  available: boolean;
  planTier: PlanTier;
  status: string | null;
  renewsAt: Date | null;
  premiumUntil: Date | null;
}

/**
 * O que a tela Plano lê da Assinatura (S5.1). Com `cancel_at` a Assinatura não renova: o premium vale até essa data
 * (`premiumUntil`) e `renewsAt` fica nulo. Sem linha, não há datas nem status.
 */
export function subscriptionView(
  available: boolean,
  planTier: PlanTier,
  row: Pick<Subscription, 'status' | 'currentPeriodEnd' | 'cancelAt'> | null,
): SubscriptionView {
  const cancelAt = row?.cancelAt ?? null;
  return {
    available,
    planTier,
    status: row?.status ?? null,
    renewsAt: cancelAt ? null : row?.currentPeriodEnd ?? null,
    premiumUntil: cancelAt,
  };
}
