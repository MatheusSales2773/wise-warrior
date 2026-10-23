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
  /** ADR-010: nome do Título equipado, ou `null`. */
  title: string | null;
  equipped: EquippedCosmeticItem[];
};

export type EquippedCosmeticItem = {
  category: 'avatar' | 'badge' | 'title' | 'accessory' | 'weapon';
  itemId: string;
  name: string;
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
  cappedReason?: 'continuous-limit' | 'daily-limit' | null;
};

/** One Study Session of the Diário (`GET /sessions/history`). */
export type SessionHistoryItem = RecentStudySession & {
  /** Place of a focus completed in full in the Pomodoro cycle (1 to 4); `null` for any other outcome. */
  cyclePosition: number | null;
};

/** The Diário filters the server applies: concluded without truncation, limited by the antifraude, not counted. */
export type SessionHistoryState = 'completed' | 'truncated' | 'discarded';

export type SessionHistoryPage = {
  items: SessionHistoryItem[];
  nextCursor: string | null;
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
  validSecondsToday: number;
  cadence: {
    windowStart: string;
    windowEnd: string;
    days: CadenceDay[];
  };
};

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  today: string;
  validSeconds: number;
  sessionCount: number;
  xp: number;
  /** Monday to Sunday, one entry per day. */
  days: { date: string; sessionCount: number; validSeconds: number }[];
  /** The subjects with the most valid focus, most first. */
  subjects: { subject: string; validSeconds: number }[];
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

export async function getSessionHistory(
  { date, state, cursor, signal }: { date?: string; state?: SessionHistoryState; cursor?: string | null; signal?: AbortSignal } = {},
): Promise<SessionHistoryPage> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (state) params.set('state', state);
  if (cursor) params.set('cursor', cursor);
  const response = await getAuthenticatedHttpClient().get<SessionHistoryPage>(`/sessions/history?${params.toString()}`, { signal });
  return response.data;
}

export async function getWeekSummary({ signal }: { signal?: AbortSignal } = {}): Promise<WeekSummary> {
  const response = await getAuthenticatedHttpClient().get<WeekSummary>('/sessions/week', { signal });
  return response.data;
}
