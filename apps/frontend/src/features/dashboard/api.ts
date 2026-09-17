import { getAuthenticatedHttpClient } from '@/core/api/api-client';

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  planTier: string;
  level: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpTotal: number;
  title: string | null;
};

export type RecentStudySession = {
  id: string;
  subject: string;
  mode: string;
  startedAt: string;
  endedAt: string;
  durationValidSeconds: number;
  xpAwarded: number;
  discardedReason: string | null;
};

export async function getMyProfile({ signal }: { signal?: AbortSignal } = {}): Promise<UserProfile> {
  const response = await getAuthenticatedHttpClient().get<UserProfile>('/users/me', { signal });
  return response.data;
}

export async function getRecentStudySessions({ signal }: { signal?: AbortSignal } = {}): Promise<RecentStudySession[]> {
  const response = await getAuthenticatedHttpClient().get<RecentStudySession[]>('/sessions/recent', { signal });
  return response.data;
}
