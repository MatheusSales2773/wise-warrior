import { useEffect } from 'react';
import { playSessionSound, type SessionSound } from './sounds';

/**
 * Rings `sound` in a loop when the local clock reaches `atMs`. Armed from the deadline itself, not from
 * a visible 1 s tick, so it still rings from a hidden tab or another route. A deadline already past when
 * it is first seen (a break that ended before mounting, a result kept across a tab switch) stays silent,
 * which also keeps it from ringing twice for the same deadline. `atMs` null disarms; a new `key` (another
 * session) or a new `atMs` (pause, resume) re-arms.
 */
export function useDeadlineAlarm({ key, atMs, sound }: { key: string | null; atMs: number | null; sound: SessionSound }) {
  useEffect(() => {
    const delay = atMs === null ? 0 : atMs - Date.now();
    if (atMs === null || delay <= 0) return;
    const timeout = setTimeout(() => playSessionSound(sound, { loop: true }), delay);
    return () => clearTimeout(timeout);
  }, [key, atMs, sound]);
}
