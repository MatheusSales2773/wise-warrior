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
  subject: string | null;
  mode: string;
  state: 'running' | 'paused' | 'completed' | 'stopped_early' | 'cancelled' | 'discarded' | null;
  startedAt: string;
  endedAt: string;
  durationValidSeconds: number;
  xpAwarded: number;
  discardedReason: string | null;
};

export type CadenceDay = {
  date: string;
  sessionCount: number;
  validSeconds: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type SessionMetrics = {
  currentStreakDays: number;
  longestStreakDays: number;
  sessionsToday: number;
  dailyGoal: number;
  validSecondsToday: number;
  cadence: {
    windowStart: string;
    windowEnd: string;
    days: CadenceDay[];
  };
};

export async function getMyProfile({ signal }: { signal?: AbortSignal } = {}): Promise<UserProfile> {
  const response = await getAuthenticatedHttpClient().get<UserProfile>('/users/me', { signal });
  return response.data;
}

export async function getRecentStudySessions({ signal }: { signal?: AbortSignal } = {}): Promise<RecentStudySession[]> {
  const response = await getAuthenticatedHttpClient().get<RecentStudySession[]>('/sessions/recent', { signal });
  return response.data;
}

export async function getSessionMetrics({ signal }: { signal?: AbortSignal } = {}): Promise<SessionMetrics> {
  const response = await getAuthenticatedHttpClient().get<SessionMetrics>('/sessions/metrics', { signal });
  return response.data;
}
