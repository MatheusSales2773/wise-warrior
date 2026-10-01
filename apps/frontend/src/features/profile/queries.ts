import { queryOptions } from '@tanstack/react-query';
import { listMyDeviceSessions } from './api';

export const profileKeys = {
  devices: () => ['profile', 'devices'] as const,
};

export const deviceSessionsQueryOptions = () => queryOptions({
  queryKey: profileKeys.devices(),
  queryFn: ({ signal }) => listMyDeviceSessions({ signal }),
  staleTime: 30_000,
  retry: false,
});
