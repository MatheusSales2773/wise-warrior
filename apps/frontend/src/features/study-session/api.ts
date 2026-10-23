import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import type { FocusChoice } from './focus-choice';
import { beginStudySessionCommand, settleStudySessionCommand, type PendingStudySessionCommand } from './pending-command';

export const STUDY_SESSION_PRESETS = [900, 1500, 3000] as const;
export type PlannedDurationSeconds = (typeof STUDY_SESSION_PRESETS)[number];
export type RaidContributionFeedback = {
  status: 'counted' | 'outside-raid-window' | 'no-validated-xp';
  xpContributed: number;
};
export type StudySessionSnapshot = {
  id: string;
  /** Absent on responses from older servers, which only know the Ciclo. */
  kind?: 'cycle' | 'free';
  mode: 'solo' | 'guild';
  raidId: string | null;
  subject: string | null;
  state: 'running' | 'paused' | 'completed' | 'stopped_early' | 'cancelled' | 'discarded';
  /** `null` in a Foco livre, which has no planned duration. */
  plannedDurationSeconds: number | null;
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
  terminalReason: 'manual-stop' | 'auto-complete' | 'legacy-session-without-owner' | null;
  discardedReason: string | null;
  /** Antifraude limit that truncated the valid focus (ADR-011); absent on responses from older servers. */
  cappedReason?: 'continuous-limit' | 'daily-limit' | null;
  /** Always true since D-006; kept for contract compatibility and never read by the app. */
  canControl: boolean;
  receivedAtMs: number;
};
export type FocusCycle = {
  completedInCycle: number;
  cycleLength: 4;
  nextBreak: 'short' | 'long';
};
/** Only transitions say whether a guild-mode Study Session counted for the Raid. */
export type StudySessionTransitionResult = StudySessionSnapshot & {
  raidContribution: RaidContributionFeedback | null;
};
export type StudySessionTransitionAction = 'pause' | 'resume' | 'stop' | 'complete';
export type StudySessionTransitionRequest = {
  id: string;
  expectedVersion: number;
  idempotencyKey: string;
};

/** Once, after the server completes an expired running focus on this read, the snapshot is that terminal result. */
export async function getActiveStudySession(signal?: AbortSignal): Promise<StudySessionSnapshot | null> {
  const response = await getAuthenticatedHttpClient().get<StudySessionSnapshot>('/sessions/active', { signal });
  return response.status === 204 ? null : { ...response.data, receivedAtMs: Date.now() };
}

export async function getFocusCycle(signal?: AbortSignal): Promise<FocusCycle> {
  const response = await getAuthenticatedHttpClient().get<FocusCycle>('/sessions/cycle', { signal });
  return response.data;
}

export async function getRecentStudySessionSubjects(signal?: AbortSignal): Promise<string[]> {
  const response = await getAuthenticatedHttpClient().get<{ subjects: string[] }>('/sessions/subjects/recent', { signal });
  return response.data.subjects;
}

/**
 * `subject` is the normalized Matéria; `null` (Sem matéria) is sent as absence. A `raidId` starts the
 * session in guild mode; a 409 then can mean the Raid already ended.
 */
export async function startStudySession(
  focus: FocusChoice,
  idempotencyKey: string,
  subject: string | null = null,
  raidId?: string,
): Promise<StudySessionSnapshot> {
  return trackStudySessionCommand({ kind: 'start' }, async () => {
    const response = await getAuthenticatedHttpClient().post<StudySessionSnapshot>(
      '/sessions',
      {
        ...(focus === 'free' ? { kind: 'free' } : { plannedDurationSeconds: focus }),
        ...(subject === null ? {} : { subject }),
        ...(raidId === undefined ? {} : { mode: 'guild', raidId }),
      },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return { ...response.data, receivedAtMs: Date.now() };
  });
}

export function pauseStudySession(command: StudySessionTransitionRequest): Promise<StudySessionTransitionResult> {
  return transitionStudySession({ ...command, action: 'pause' });
}

export function resumeStudySession(command: StudySessionTransitionRequest): Promise<StudySessionTransitionResult> {
  return transitionStudySession({ ...command, action: 'resume' });
}

export function stopStudySession(command: StudySessionTransitionRequest): Promise<StudySessionTransitionResult> {
  return transitionStudySession({ ...command, action: 'stop' });
}

export function completeStudySession(command: StudySessionTransitionRequest): Promise<StudySessionTransitionResult> {
  return transitionStudySession({ ...command, action: 'complete' });
}

async function transitionStudySession(
  { id, action, expectedVersion, idempotencyKey }: StudySessionTransitionRequest & { action: StudySessionTransitionAction },
): Promise<StudySessionTransitionResult> {
  // An applied transition writes the next version; a replay keeps the receipt's version and emits no event.
  return trackStudySessionCommand({ kind: 'transition', studySessionId: id, version: expectedVersion + 1 }, async () => {
    const response = await getAuthenticatedHttpClient().post<StudySessionTransitionResult>(
      `/sessions/${id}/${action}`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return { ...response.data, receivedAtMs: Date.now() };
  });
}

/** The realtime echo of a command is held while it runs, then dropped or applied by what the server answered. */
async function trackStudySessionCommand<T extends StudySessionSnapshot>(
  command: PendingStudySessionCommand,
  send: () => Promise<T>,
): Promise<T> {
  beginStudySessionCommand(command);
  let result: T | null = null;
  try {
    result = await send();
    return result;
  } finally {
    settleStudySessionCommand(command, result && { studySessionId: result.id, version: result.version });
  }
}

export async function heartbeatStudySession(id: string, signal?: AbortSignal): Promise<void> {
  await getAuthenticatedHttpClient().patch(`/sessions/${id}/heartbeat`, undefined, { signal });
}
