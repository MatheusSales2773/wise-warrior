import { useEffect, useRef } from 'react';
import { playSessionSound, releaseSessionSounds } from './sounds';

/** Runs `onChange` when `value` changes while mounted: a value already there at mount never counts as a change. */
function useOnChange<T>(value: T, onChange: (previous: T, next: T) => void) {
  const previous = useRef(value);
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before !== value) onChange(before, value);
  });
}

const breakRanOut = (previous: number | null, next: number | null) => previous !== null && previous > 0 && next === 0;
const focusCompleted = (previous: string | null, next: string | null) => next !== null && next !== previous;

/**
 * Rings when a break runs out or a focus completes while the screen is watching. Whatever was already
 * there at mount (a break that ended, a result kept across a tab switch) stays silent.
 */
export function useSessionEndSounds({ breakRemaining, completedSessionId }: {
  breakRemaining: number | null;
  completedSessionId: string | null;
}) {
  useOnChange(breakRemaining, (previous, next) => {
    if (breakRanOut(previous, next)) playSessionSound('breakEnd');
  });
  useOnChange(completedSessionId, (previous, next) => {
    if (focusCompleted(previous, next)) playSessionSound('focusEnd');
  });
  useEffect(() => releaseSessionSounds, []);
}
