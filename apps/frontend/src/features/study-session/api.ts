import { getAuthenticatedHttpClient } from '@/core/api/api-client';

export const STUDY_SESSION_PRESETS = [900, 1500, 3000] as const;
export type PlannedDurationSeconds = (typeof STUDY_SESSION_PRESETS)[number];
export type StudySessionSnapshot = {
  id: string;
  mode: 'solo' | 'guild';
  subject: string | null;
  state: 'running' | 'paused' | 'completed' | 'stopped_early' | 'cancelled' | 'discarded';
  plannedDurationSeconds: number;
  startedAt: string;
  runDeadlineAt: string | null;
  pausedAt: string | null;
  pausedTotalSeconds: number;
  durationValidSeconds: number;
  remainingSeconds: number;
  serverNow: string;
  version: number;
  endedAt: string | null;
  xpAwarded: number;
  terminalReason: string | null;
  discardedReason: string | null;
  canControl: boolean;
  receivedAtMs: number;
};

export async function getActiveStudySession(signal?: AbortSignal): Promise<StudySessionSnapshot | null> {
  const response = await getAuthenticatedHttpClient().get<StudySessionSnapshot>('/sessions/active', { signal });
  return response.status === 204 ? null : { ...response.data, receivedAtMs: Date.now() };
}

export async function startStudySession(plannedDurationSeconds: PlannedDurationSeconds, idempotencyKey: string): Promise<StudySessionSnapshot> {
  const response = await getAuthenticatedHttpClient().post<StudySessionSnapshot>(
    '/sessions',
    { plannedDurationSeconds },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return { ...response.data, receivedAtMs: Date.now() };
}

export async function heartbeatStudySession(id: string, signal?: AbortSignal): Promise<void> {
  await getAuthenticatedHttpClient().patch(`/sessions/${id}/heartbeat`, undefined, { signal });
}
