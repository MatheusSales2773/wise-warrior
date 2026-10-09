import { queryOptions } from '@tanstack/react-query';
import { getMyDeviceSessions } from './api';

export const characterKeys = {
  all: ['character'] as const,
  devices: () => ['character', 'devices'] as const,
};

export const deviceSessionsQueryOptions = () => queryOptions({
  queryKey: characterKeys.devices(),
  queryFn: ({ signal }) => getMyDeviceSessions({ signal }),
  staleTime: 30_000,
  retry: false,
});
