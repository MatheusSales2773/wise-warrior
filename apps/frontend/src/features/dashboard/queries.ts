import { queryOptions } from '@tanstack/react-query';
import { getMyProfile, getRecentStudySessions } from './api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  profile: () => ['dashboard', 'profile'] as const,
  recentActivity: () => ['dashboard', 'recent-activity'] as const,
};

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
