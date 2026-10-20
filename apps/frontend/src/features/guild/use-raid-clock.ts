import { useEffect, useState } from 'react';
import type { ActiveRaid } from './api';

/** How often the Raid countdowns and the attack lock catch up with the clock. */
const RAID_CLOCK_INTERVAL_MS = 30_000;

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Milliseconds until the Raid ends; negative once it is over. */
export function useRaidTimeLeft(raid: Pick<ActiveRaid, 'endsAt'>): number {
  const now = useNow(RAID_CLOCK_INTERVAL_MS);
  return new Date(raid.endsAt).getTime() - now;
}
