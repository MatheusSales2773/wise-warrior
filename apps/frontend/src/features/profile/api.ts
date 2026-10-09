import { getAuthenticatedHttpClient } from '@/core/api/api-client';

export type DeviceSession = {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
};

export type CosmeticCategory = 'avatar' | 'badge' | 'title' | 'accessory';

/** `slug` `*` vale para qualquer Raid. */
export type UnlockCondition = { type: 'level'; level: number } | { type: 'raid'; slug: string };

export type CatalogCosmeticItem = {
  id: string;
  category: CosmeticCategory;
  name: string;
  requiresPremium: boolean;
  unlocked: boolean;
  equipped: boolean;
  unlockCondition: UnlockCondition;
};

export async function listMyCosmetics({ signal }: { signal?: AbortSignal } = {}): Promise<CatalogCosmeticItem[]> {
  const response = await getAuthenticatedHttpClient().get<CatalogCosmeticItem[]>('/users/me/cosmetics', { signal });
  return response.data;
}

export async function listMyDeviceSessions({ signal }: { signal?: AbortSignal } = {}): Promise<DeviceSession[]> {
  const response = await getAuthenticatedHttpClient().get<DeviceSession[]>('/users/me/sessions', { signal });
  return response.data;
}
