import { useSyncExternalStore } from 'react';
import type { RealtimeChannel, RealtimeStatus } from './realtime-client';

/** The connection screens use to talk to the gateway beyond the events the client applies itself. */
export type ActiveRealtime = { channel: RealtimeChannel; status: RealtimeStatus };

let active: ActiveRealtime | null = null;
const subscribers = new Set<() => void>();

/** Called by `RealtimeRuntime` as the Session's socket comes and goes (and by tests, with a fake). */
export function setActiveRealtime(next: ActiveRealtime | null): void {
  active = next;
  subscribers.forEach((subscriber) => subscriber());
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

/** The Session's one realtime connection, or `null` while there is none. */
export function useActiveRealtime(): ActiveRealtime | null {
  return useSyncExternalStore(subscribe, () => active, () => active);
}
