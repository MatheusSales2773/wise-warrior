import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRealtimeEvent } from '@/core/realtime/realtime-runtime';
import type { ActiveRaid } from './api';
import { guildKeys } from './queries';

export type RaidProgressEvent = { raidId: string; progressXp: number; goalXp: number; goalReachedAt: string | null };

function isRaidProgress(payload: unknown): payload is RaidProgressEvent {
  const event = payload as Partial<RaidProgressEvent> | null;
  return typeof event?.raidId === 'string' && typeof event.progressXp === 'number' && typeof event.goalXp === 'number';
}


/** `raid:progress`: the active Raid cache takes the new progress at once, and the Ranking interno reloads. */
export function applyRaidProgress(queryClient: QueryClient, payload: unknown): void {
  if (!isRaidProgress(payload)) return;
  // The Raid key prefixes the ranking and past Raids queries; the Raid itself is `['guild', 'raid', guildId]`.
  queryClient.setQueriesData<ActiveRaid | null>({ queryKey: [...guildKeys.all, 'raid'], predicate: (query) => query.queryKey.length === 3 }, (current) => (
    current && current.id === payload.raidId
      ? { ...current, progressXp: payload.progressXp, goalXp: payload.goalXp, goalReachedAt: payload.goalReachedAt ?? null }
      : current
  ));
  void queryClient.invalidateQueries({
    queryKey: [...guildKeys.all, 'raid'],
    predicate: (query) => query.queryKey[3] === 'ranking' && query.queryKey[4] === payload.raidId,
  });
}


/** Keeps the Guild caches in step with the server events while the signed-in area is open. */
export function GuildRealtimeEvents() {
  const queryClient = useQueryClient();
  useRealtimeEvent('raid:progress', (payload) => applyRaidProgress(queryClient, payload));
  // Events missed while offline: after a reconnection the Raid, its ranking and the past Raids reload from REST.
  useRealtimeEvent('connect', () => {
    void queryClient.invalidateQueries({ queryKey: [...guildKeys.all, 'raid'] });
  });
  return null;
}
