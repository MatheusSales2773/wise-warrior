import type { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { AuthenticationRecoveryResult } from '@/core/api/api-client';
import type { ActiveRaid } from '@/features/guild/api';
import { dashboardKeys } from '@/features/dashboard/queries';
import { guildKeys } from '@/features/guild/queries';
import { profileKeys } from '@/features/profile/queries';

/** Payload of the `raid:progress` event (docs/api/asyncapi.yaml). */
export type RaidProgressEvent = Pick<ActiveRaid, 'progressXp' | 'goalXp' | 'goalReachedAt'> & { raidId: string };

/** Payload of the `notification:raidComplete` event (docs/api/asyncapi.yaml). */
export type RaidCompleteEvent = {
  raidId: string;
  guildId: string;
  status: 'completed' | 'expired';
  rewardItemId: string | null;
};

/** Payload of the `progress:xpUpdated` event (docs/api/asyncapi.yaml). */
export type XpUpdatedEvent = { xpGained: number; xpTotal: number; level: number };

/** Where the connection stands, for the visible indicator. */
export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

type Listener = (...args: any[]) => void;

/** The slice of the Socket.IO 4.x client the runtime uses, so tests can supply a fake. */
export interface RealtimeSocket {
  readonly active: boolean;
  on(event: string, listener: Listener): unknown;
  off(event: string, listener?: Listener): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export type RealtimeSocketFactory = (
  url: string,
  options: { auth: (callback: (data: { token: string | null }) => void) => void; transports: string[]; autoConnect: boolean },
) => RealtimeSocket;

export type RealtimeClientOptions = {
  url: string;
  queryClient: QueryClient;
  getToken: () => string | null;
  recover: () => Promise<AuthenticationRecoveryResult>;
  createSocket?: RealtimeSocketFactory;
};

export type RealtimeClient = {
  dispose(): void;
  getStatus(): RealtimeStatus;
  subscribe(listener: () => void): () => void;
};

/** XP earned on any device changes the Dashboard (Nível, XP, recent activity, metrics) and the Personagem. */
export function applyXpUpdated(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

/** A level-up also unlocks cosmetics, so the catalog is refreshed along with the Dashboard. */
export function applyLevelUp(queryClient: QueryClient): void {
  applyXpUpdated(queryClient);
  void queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() });
}

/** Active Raid queries are `['guild', 'raid', guildId]`; the ranking and past Raids nest deeper under that key. */
function isActiveRaidKey(key: readonly unknown[]): boolean {
  return key.length === 3 && key[1] === 'raid';
}

export function applyRaidProgress(queryClient: QueryClient, event: RaidProgressEvent): void {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: guildKeys.all })) {
    if (!isActiveRaidKey(query.queryKey)) continue;
    queryClient.setQueryData<ActiveRaid>(query.queryKey, (raid) => (raid && raid.id === event.raidId
      ? { ...raid, progressXp: event.progressXp, goalXp: event.goalXp, goalReachedAt: event.goalReachedAt }
      : raid));
  }
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'guild' && queryKey[1] === 'raid' && queryKey[3] === 'ranking' && queryKey[4] === event.raidId,
  });
}

/**
 * A closed Raid changes the Guild screen (result, Nível, next week's Raid) and, with a Recompensa, the cosmetics
 * catalog. The `['guild', 'raid']` prefix covers the active Raid, its ranking and the past Raids.
 */
export function applyRaidComplete(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: guildKeys.raids() });
  void queryClient.invalidateQueries({ queryKey: guildKeys.mine() });
  void queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() });
}

/**
 * Socket.IO client authenticated with the in-memory access token (ADR-009). One socket carries every listener,
 * registered once: automatic reconnections reuse it, and the `auth` callback runs on each attempt, so they carry
 * whatever token the HTTP layer holds by then. When the server turns the handshake down (an expired token), the
 * socket stops retrying; the client then refreshes the token and connects again.
 */
export function createRealtimeClient({
  url,
  queryClient,
  getToken,
  recover,
  createSocket = io as unknown as RealtimeSocketFactory,
}: RealtimeClientOptions): RealtimeClient {
  let disposed = false;
  let recovering = false;
  let connectedBefore = false;
  let status: RealtimeStatus = 'connecting';
  const subscribers = new Set<() => void>();
  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return;
    status = next;
    subscribers.forEach((subscriber) => subscriber());
  };
  const socket = createSocket(url, {
    auth: (callback) => callback({ token: getToken() }),
    transports: ['websocket'],
    autoConnect: false,
  });

  const onRaidProgress = (event: RaidProgressEvent) => applyRaidProgress(queryClient, event);
  const onRaidComplete = () => applyRaidComplete(queryClient);
  const onXpUpdated = () => applyXpUpdated(queryClient);
  const onLevelUp = () => applyLevelUp(queryClient);
  const reconnectAfterRefresh = () => {
    if (disposed) return;
    if (socket.active) {
      // Socket.IO keeps retrying on its own.
      setStatus('reconnecting');
      return;
    }
    if (recovering) return;
    recovering = true;
    setStatus('reconnecting');
    void recover().then((result) => {
      if (disposed) return;
      if (result.status === 'authenticated') socket.connect();
      else setStatus('offline');
    }).catch(() => { if (!disposed) setStatus('offline'); }).finally(() => { recovering = false; });
  };
  // Events missed while the socket was down are not replayed, so a reconnection refetches the Raid and its ranking.
  const onConnect = () => {
    setStatus('connected');
    if (connectedBefore) void queryClient.invalidateQueries({ queryKey: guildKeys.all, predicate: ({ queryKey }) => queryKey[1] === 'raid' });
    connectedBefore = true;
  };

  socket.on('raid:progress', onRaidProgress);
  socket.on('notification:raidComplete', onRaidComplete);
  socket.on('progress:xpUpdated', onXpUpdated);
  socket.on('notification:levelup', onLevelUp);
  socket.on('connect', onConnect);
  socket.on('connect_error', reconnectAfterRefresh);
  socket.on('disconnect', reconnectAfterRefresh);
  socket.connect();

  return {
    getStatus: () => status,
    subscribe(listener) {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    dispose() {
      disposed = true;
      socket.off('raid:progress', onRaidProgress);
      socket.off('notification:raidComplete', onRaidComplete);
      socket.off('progress:xpUpdated', onXpUpdated);
      socket.off('notification:levelup', onLevelUp);
      socket.off('connect', onConnect);
      socket.off('connect_error', reconnectAfterRefresh);
      socket.off('disconnect', reconnectAfterRefresh);
      socket.disconnect();
    },
  };
}
