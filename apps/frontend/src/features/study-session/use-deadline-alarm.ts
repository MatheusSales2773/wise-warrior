import { useEffect, useRef } from 'react';
import { playSessionSound, type SessionSound } from './sounds';

/**
 * Rings `sound` in a loop when the local clock reaches `atMs`. Armed from the deadline itself, not from
 * a visible 1 s tick, so it still rings from a hidden tab or another route. A deadline already past when
 * it is first seen (a break that ended before mounting, a result kept across a tab switch) stays silent.
 * `atMs` null disarms, and it rings once per deadline.
 */
export function useDeadlineAlarm({ atMs, sound }: { atMs: number | null; sound: SessionSound }) {
  const rung = useRef<number | null>(null);
  useEffect(() => {
    if (atMs === null || atMs <= Date.now() || rung.current === atMs) return;
    const timeout = setTimeout(() => {
      rung.current = atMs;
      playSessionSound(sound, { loop: true });
    }, atMs - Date.now());
    return () => clearTimeout(timeout);
  }, [atMs, sound]);
}
