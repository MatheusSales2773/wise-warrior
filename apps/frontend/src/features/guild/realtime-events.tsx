import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRealtimeEvent } from '@/core/realtime/realtime-runtime';
import { profileKeys } from '@/features/profile/queries';
import type { ActiveRaid } from './api';
import { guildKeys } from './queries';

export type RaidProgressEvent = { raidId: string; progressXp: number; goalXp: number; goalReachedAt: string | null };
export type RaidCompleteEvent = { raidId: string; guildId: string; status: 'completed' | 'expired'; rewardItemId: string | null };

function isRaidProgress(payload: unknown): payload is RaidProgressEvent {
  const event = payload as Partial<RaidProgressEvent> | null;
  return typeof event?.raidId === 'string' && typeof event.progressXp === 'number' && typeof event.goalXp === 'number';
}

function isRaidComplete(payload: unknown): payload is RaidCompleteEvent {
  const event = payload as Partial<RaidCompleteEvent> | null;
  return typeof event?.raidId === 'string' && typeof event.guildId === 'string';
}

/** `raid:progress`: the active Raid cache takes the new progress at once, and the Ranking interno reloads. */
export function applyRaidProgress(queryClient: QueryClient, payload: unknown): void {
  if (!isRaidProgress(payload)) return;
  queryClient.setQueriesData<ActiveRaid | null>({ queryKey: [...guildKeys.all, 'raid'] }, (current) => (
    current && current.id === payload.raidId
      ? { ...current, progressXp: payload.progressXp, goalXp: payload.goalXp, goalReachedAt: payload.goalReachedAt ?? null }
      : current
  ));
  void queryClient.invalidateQueries({ queryKey: guildKeys.ranking(payload.raidId) });
}

/** `notification:raidComplete`: the result, the new level, the next week's Raid and the reward all reload. */
export function applyRaidComplete(queryClient: QueryClient, payload: unknown): void {
  if (!isRaidComplete(payload)) return;
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: guildKeys.raid(payload.guildId) }),
    queryClient.invalidateQueries({ queryKey: guildKeys.pastRaids(payload.guildId) }),
    queryClient.invalidateQueries({ queryKey: guildKeys.ranking(payload.raidId) }),
    queryClient.invalidateQueries({ queryKey: guildKeys.mine() }),
    queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() }),
  ]);
}

/** Keeps the Guild caches in step with the server events while the signed-in area is open. No toast in this delivery. */
export function GuildRealtimeEvents() {
  const queryClient = useQueryClient();
  useRealtimeEvent('raid:progress', (payload) => applyRaidProgress(queryClient, payload));
  useRealtimeEvent('notification:raidComplete', (payload) => applyRaidComplete(queryClient, payload));
  // Events missed while offline: after a reconnection the Raid and the ranking reload from REST.
  useRealtimeEvent('connect', () => {
    void queryClient.invalidateQueries({ queryKey: [...guildKeys.all, 'raid'] });
    void queryClient.invalidateQueries({ queryKey: [...guildKeys.all, 'ranking'] });
  });
  return null;
}
