import { queryOptions } from '@tanstack/react-query';
import { listCosmeticsCatalog, listMyDeviceSessions } from './api';

export const profileKeys = {
  cosmeticsCatalog: () => ['profile', 'cosmetics-catalog'] as const,
  devices: () => ['profile', 'devices'] as const,
};

export const deviceSessionsQueryOptions = () => queryOptions({
  queryKey: profileKeys.devices(),
  queryFn: ({ signal }) => listMyDeviceSessions({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const cosmeticsCatalogQueryOptions = () => queryOptions({
  queryKey: profileKeys.cosmeticsCatalog(),
  queryFn: ({ signal }) => listCosmeticsCatalog({ signal }),
  staleTime: 30_000,
  retry: false,
});
