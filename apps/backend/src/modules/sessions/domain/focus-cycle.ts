export const FOCUS_CYCLE_LENGTH = 4;

export type FocusBreak = 'short' | 'long';

export type FocusCycle = {
  /** 0..4. Four means the cycle is full and the next offered break is the long one. */
  completedInCycle: number;
  cycleLength: typeof FOCUS_CYCLE_LENGTH;
  nextBreak: FocusBreak;
};

/**
 * Pomodoro cadence (D-027): the cycle position derives from how many focuses the user completed in
 * full. Early stops, cancellations and discards never count, so they neither advance nor reset it.
 * A fifth completed focus starts a fresh cycle, which is the same as finishing the long break.
 */
export function focusCycle(completedFocuses: number): FocusCycle {
  const remainder = completedFocuses % FOCUS_CYCLE_LENGTH;
  const completedInCycle = completedFocuses > 0 && remainder === 0 ? FOCUS_CYCLE_LENGTH : remainder;
  return {
    completedInCycle,
    cycleLength: FOCUS_CYCLE_LENGTH,
    nextBreak: completedInCycle === FOCUS_CYCLE_LENGTH ? 'long' : 'short',
  };
}
