import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { SessionHistoryState } from './api';
import { getMyProfile, getRecentStudySessions, getSessionMetrics, getSessionHistory, getWeekSummary } from './api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  profile: () => ['dashboard', 'profile'] as const,
  recentActivity: () => ['dashboard', 'recent-activity'] as const,
  metrics: () => ['dashboard', 'metrics'] as const,
  week: () => ['dashboard', 'week'] as const,
  // Under the dashboard key: XP earned on any device (progress:xpUpdated) refreshes every history too.
  history: (scope: { date?: string; state?: string } = {}) => ['dashboard', 'history', scope] as const,
};

const SAO_PAULO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The São Paulo calendar day of an instant, as `/sessions/metrics` and `/sessions/history` count days. */
export function saoPauloDay(at: number = Date.now()): string {
  return SAO_PAULO_DAY.format(new Date(at));
}

/** One day of the history (`date`), or the whole Diário across days, optionally narrowed to one outcome. */
export const sessionHistoryQueryOptions = ({ date, state }: { date?: string; state?: SessionHistoryState } = {}) => infiniteQueryOptions({
  queryKey: dashboardKeys.history({ date, state }),
  queryFn: ({ pageParam, signal }) => getSessionHistory({ date, state, cursor: pageParam, signal }),
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

/** The Diário's week cards. Under the dashboard key, so XP earned on any device refreshes them too. */
export const weekSummaryQueryOptions = () => queryOptions({
  queryKey: dashboardKeys.week(),
  queryFn: ({ signal }) => getWeekSummary({ signal }),
  staleTime: 30_000,
  retry: false,
});
