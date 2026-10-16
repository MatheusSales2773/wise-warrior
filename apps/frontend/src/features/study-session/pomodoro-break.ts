import type { QueryClient } from '@tanstack/react-query';

export const BREAK_SECONDS = { short: 300, long: 900 } as const;

export type BreakKind = keyof typeof BREAK_SECONDS;

/** Breaks are local to the device (D-027): they grant no XP and never occupy a Study Session. */
export type BreakRun = { kind: BreakKind; durationSeconds: number; deadlineMs: number };

export const breakQueryKey = ['study-session', 'break'] as const;

/**
 * The running break lives in the query cache: it survives leaving the Forja for another tab, and the
 * cache is cleared on logout and on session expiry, so a break never leaks to the next user.
 */
export function startBreak(queryClient: QueryClient, kind: BreakKind, nowMs: number): BreakRun {
  const durationSeconds = BREAK_SECONDS[kind];
  const run: BreakRun = { kind, durationSeconds, deadlineMs: nowMs + durationSeconds * 1000 };
  // Nothing observes this entry, so without this it would be garbage collected after five minutes.
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

export function breakRemainingSeconds(run: BreakRun, nowMs: number): number {
  return Math.max(0, Math.ceil((run.deadlineMs - nowMs) / 1000));
}
