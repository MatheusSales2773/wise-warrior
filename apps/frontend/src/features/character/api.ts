import { getAuthenticatedHttpClient } from '@/core/api/api-client';

export type DeviceSession = {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
};

export async function getMyDeviceSessions({ signal }: { signal?: AbortSignal } = {}): Promise<DeviceSession[]> {
  const response = await getAuthenticatedHttpClient().get<DeviceSession[]>('/users/me/sessions', { signal });
  return response.data;
}
