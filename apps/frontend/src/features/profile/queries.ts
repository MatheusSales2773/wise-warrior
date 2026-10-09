import { queryOptions } from '@tanstack/react-query';
import { listMyCosmetics, listMyDeviceSessions } from './api';

export const profileKeys = {
  cosmetics: () => ['profile', 'cosmetics'] as const,
  devices: () => ['profile', 'devices'] as const,
};

export const deviceSessionsQueryOptions = () => queryOptions({
  queryKey: profileKeys.devices(),
  queryFn: ({ signal }) => listMyDeviceSessions({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const cosmeticsQueryOptions = () => queryOptions({
  queryKey: profileKeys.cosmetics(),
  queryFn: ({ signal }) => listMyCosmetics({ signal }),
  staleTime: 30_000,
  retry: false,
});
