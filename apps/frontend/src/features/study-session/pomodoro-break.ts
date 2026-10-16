export const BREAK_SECONDS = { short: 300, long: 900 } as const;

export type BreakKind = keyof typeof BREAK_SECONDS;

/** Breaks are local to the device (D-027): they grant no XP and never occupy a Study Session. */
export type BreakRun = { kind: BreakKind; durationSeconds: number; deadlineMs: number };

let retainedBreak: BreakRun | null = null;

export function startBreak(kind: BreakKind, nowMs: number): BreakRun {
  const durationSeconds = BREAK_SECONDS[kind];
  retainedBreak = { kind, durationSeconds, deadlineMs: nowMs + durationSeconds * 1000 };
  return retainedBreak;
}

/** Kept outside React so leaving the Forja for another tab does not lose a running break. */
export function currentBreak(): BreakRun | null {
  return retainedBreak;
}

export function clearBreak(): void {
  retainedBreak = null;
}

export function breakRemainingSeconds(run: BreakRun, nowMs: number): number {
  return Math.max(0, Math.ceil((run.deadlineMs - nowMs) / 1000));
}
