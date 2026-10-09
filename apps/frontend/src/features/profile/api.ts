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

export async function listCosmeticsCatalog({ signal }: { signal?: AbortSignal } = {}): Promise<CatalogCosmeticItem[]> {
  const response = await getAuthenticatedHttpClient().get<CatalogCosmeticItem[]>('/users/me/cosmetics', { signal });
  return response.data;
}

/** Troca o item equipado da categoria; 403 quando a política de entitlement bloqueia o item premium (ADR-007). */
export async function equipCosmeticItem(itemId: string): Promise<void> {
  await getAuthenticatedHttpClient().patch(`/users/me/cosmetics/${encodeURIComponent(itemId)}`);
}

/** Desequipa o item; idempotente, 404 quando ele não está no Inventário. */
export async function unequipCosmeticItem(itemId: string): Promise<void> {
  await getAuthenticatedHttpClient().delete(`/users/me/cosmetics/${encodeURIComponent(itemId)}/equipped`);
}

export async function listMyDeviceSessions({ signal }: { signal?: AbortSignal } = {}): Promise<DeviceSession[]> {
  const response = await getAuthenticatedHttpClient().get<DeviceSession[]>('/users/me/sessions', { signal });
  return response.data;
}

/** Encerra um dispositivo específico; 404 quando a sessão já não está ativa (ADR-009). */
export async function revokeMyDeviceSession(sessionId: string): Promise<void> {
  await getAuthenticatedHttpClient().delete(`/users/me/sessions/${encodeURIComponent(sessionId)}`);
}

/** "Sair de todos os dispositivos", inclusive este. */
export async function revokeAllMyDeviceSessions(): Promise<void> {
  await getAuthenticatedHttpClient().delete('/users/me/sessions');
}
