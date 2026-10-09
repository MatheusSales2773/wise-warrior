import { getAuthenticatedHttpClient } from '@/core/api/api-client';

export type DeviceSession = {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
};

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
