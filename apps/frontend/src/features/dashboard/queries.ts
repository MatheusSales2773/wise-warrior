import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getMyProfile, getRecentStudySessions, getSessionMetrics, getSessionHistory } from './api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  profile: () => ['dashboard', 'profile'] as const,
  recentActivity: () => ['dashboard', 'recent-activity'] as const,
  metrics: () => ['dashboard', 'metrics'] as const,
  // Under the dashboard key: XP earned on any device (progress:xpUpdated) refreshes the day history too.
  history: (date: string) => ['dashboard', 'history', date] as const,
};

const SAO_PAULO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The São Paulo calendar day of an instant, as `/sessions/metrics` and `/sessions/history` count days. */
export function saoPauloDay(at: number = Date.now()): string {
  return SAO_PAULO_DAY.format(new Date(at));
}

export const sessionHistoryQueryOptions = (date: string) => infiniteQueryOptions({
  queryKey: dashboardKeys.history(date),
  queryFn: ({ pageParam, signal }) => getSessionHistory(date, { cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 30_000,
  retry: false,
});

export const profileQueryOptions = () => queryOptions({
  queryKey: dashboardKeys.profile(),
  queryFn: ({ signal }) => getMyProfile({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const recentActivityQueryOptions = () => queryOptions({
  queryKey: dashboardKeys.recentActivity(),
  queryFn: ({ signal }) => getRecentStudySessions({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const sessionMetricsQueryOptions = () => queryOptions({
  queryKey: dashboardKeys.metrics(),
  queryFn: ({ signal }) => getSessionMetrics({ signal }),
  staleTime: 30_000,
  retry: false,
});
