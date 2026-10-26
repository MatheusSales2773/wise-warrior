import { useEffect, useState } from 'react';

export const MINUTE_MS = 60_000;

/** Re-reads the clock each minute so the countdown keeps moving while the tab stays open. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
