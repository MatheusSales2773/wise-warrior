import { queryOptions, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Linking, Platform } from 'react-native';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { getSubscription } from './api';
import { planLabel } from './plan';

export const billingKeys = { subscription: () => ['billing', 'subscription'] as const };

export const subscriptionQueryOptions = () => queryOptions({
  queryKey: billingKeys.subscription(),
  queryFn: ({ signal }) => getSubscription({ signal }),
  staleTime: 30_000,
  retry: false,
});

/** The Web leaves for Stripe in the same tab; the native app hands the page to the system browser (S5.4). */
export async function openStripePage(url: string): Promise<void> {
  if (Platform.OS === 'web') window.location.assign(url);
  else await Linking.openURL(url);
}

/** S5.11: the server's own words for 409, 502 and 503 (and 404 for a Pacote, S8.9); anything else gets a generic line. */
export function billingErrorMessage(
  error: unknown,
  statuses: readonly number[] = [409, 502, 503],
  fallback = 'Não foi possível abrir o pagamento. Tente de novo.',
): string {
  if (isAxiosError(error) && statuses.includes(error.response?.status ?? 0)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return fallback;
}

/** The plan in the Configuração list and menu; `undefined` until both the profile and the billing state are known. */
export function usePlanLabel(): string | undefined {
  const profile = useQuery(profileQueryOptions());
  const subscription = useQuery(subscriptionQueryOptions());
  if (!profile.data || subscription.isPending) return undefined;
  return planLabel(profile.data.planTier, subscription.data?.available ?? false);
}
