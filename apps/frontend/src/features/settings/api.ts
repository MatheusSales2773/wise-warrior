import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import type { UserProfile } from '@/features/dashboard/api';

/** `PATCH /users/me`: renames the warrior and returns the profile in the shape of `GET /users/me`. */
export async function updateMyDisplayName(displayName: string): Promise<UserProfile> {
  const response = await getAuthenticatedHttpClient().patch<UserProfile>('/users/me', { displayName });
  return response.data;
}

/** `GET /billing/subscription` (S5.1); dates are ISO strings. */
export type SubscriptionView = {
  available: boolean;
  planTier: string;
  status: string | null;
  renewsAt: string | null;
  premiumUntil: string | null;
};

export async function getSubscription({ signal }: { signal?: AbortSignal } = {}): Promise<SubscriptionView> {
  return (await getAuthenticatedHttpClient().get<SubscriptionView>('/billing/subscription', { signal })).data;
}

/** `POST /billing/checkout` or `POST /billing/portal`: the Stripe page to open. */
export async function openBillingSession(kind: 'checkout' | 'portal'): Promise<string> {
  return (await getAuthenticatedHttpClient().post<{ url: string }>(`/billing/${kind}`, {})).data.url;
}

/** `POST /billing/dev/reset-plan`: cancels the Subscription now (202); the plan turns Free when the webhook arrives. */
export async function resetMyPlan(): Promise<void> {
  await getAuthenticatedHttpClient().post('/billing/dev/reset-plan', {});
}
