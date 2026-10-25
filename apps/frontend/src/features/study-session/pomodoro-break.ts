import { useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { StudySessionSnapshot } from './api';

export const BREAK_SECONDS = { short: 300, long: 900 } as const;

/** Focuses in a Pomodoro cycle: the fourth earns the long break. */
export const CYCLE_LENGTH = 4;

export type BreakKind = keyof typeof BREAK_SECONDS;

/** The focus that earned the break, shown on the break card; `completedInCycle` is null while the cycle is unknown. */
export type BreakPrevious = { subject: string | null; validSeconds: number; xpAwarded: number; completedInCycle: number | null };

export function breakPrevious(result: Pick<StudySessionSnapshot, 'subject' | 'durationValidSeconds' | 'xpAwarded'>, completedInCycle: number | null): BreakPrevious {
  return { subject: result.subject, validSeconds: result.durationValidSeconds, xpAwarded: result.xpAwarded, completedInCycle };
}

/** Breaks are local to the device (D-027): they grant no XP and never occupy a Study Session. */
export type BreakRun = { kind: BreakKind; durationSeconds: number; deadlineMs: number; previous?: BreakPrevious };

export const breakQueryKey = ['study-session', 'break'] as const;

/**
 * The running break lives in the query cache: it survives leaving the Forja for another tab, and the
 * cache is cleared on logout and on session expiry, so a break never leaks to the next user.
 */
export function startBreak(queryClient: QueryClient, kind: BreakKind, nowMs: number, previous?: BreakPrevious): BreakRun {
  const durationSeconds = BREAK_SECONDS[kind];
  const run: BreakRun = { kind, durationSeconds, deadlineMs: nowMs + durationSeconds * 1000, ...(previous ? { previous } : {}) };
  // No query observer holds this entry (useBreakRun listens to the cache), so without this it would be
  // garbage collected after five minutes.
  queryClient.setQueryDefaults(breakQueryKey, { gcTime: Infinity });
  queryClient.setQueryData(breakQueryKey, run);
  return run;
}

export function currentBreak(queryClient: QueryClient): BreakRun | null {
  return queryClient.getQueryData<BreakRun>(breakQueryKey) ?? null;
}

export function clearBreak(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: breakQueryKey });
}

/** The running break, reactive to `startBreak` and `clearBreak` wherever they are called from. */
export function useBreakRun(): BreakRun | null {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (notify) => queryClient.getQueryCache().subscribe(notify),
    () => currentBreak(queryClient),
  );
}

export function breakRemainingSeconds(run: BreakRun, nowMs: number): number {
  return Math.max(0, Math.ceil((run.deadlineMs - nowMs) / 1000));
}
