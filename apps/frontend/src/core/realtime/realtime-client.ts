import type { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { AuthenticationRecoveryResult } from '@/core/api/api-client';
import type { ActiveRaid } from '@/features/guild/api';
import { guildKeys } from '@/features/guild/queries';

/** Payload of the `raid:progress` event (docs/api/asyncapi.yaml). */
export type RaidProgressEvent = Pick<ActiveRaid, 'progressXp' | 'goalXp' | 'goalReachedAt'> & { raidId: string };

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

export type RealtimeClient = { dispose(): void };

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
  const socket = createSocket(url, {
    auth: (callback) => callback({ token: getToken() }),
    transports: ['websocket'],
    autoConnect: false,
  });

  const onRaidProgress = (event: RaidProgressEvent) => applyRaidProgress(queryClient, event);
  const reconnectAfterRefresh = () => {
    if (disposed || socket.active || recovering) return;
    recovering = true;
    void recover().then((result) => {
      if (!disposed && result.status === 'authenticated') socket.connect();
    }).finally(() => { recovering = false; });
  };
  // Events missed while the socket was down are not replayed, so a reconnection refetches the Raid and its ranking.
  const onConnect = () => {
    if (connectedBefore) void queryClient.invalidateQueries({ queryKey: guildKeys.all, predicate: ({ queryKey }) => queryKey[1] === 'raid' });
    connectedBefore = true;
  };

  socket.on('raid:progress', onRaidProgress);
  socket.on('connect', onConnect);
  socket.on('connect_error', reconnectAfterRefresh);
  socket.on('disconnect', reconnectAfterRefresh);
  socket.connect();

  return {
    dispose() {
      disposed = true;
      socket.off('raid:progress', onRaidProgress);
      socket.off('connect', onConnect);
      socket.off('connect_error', reconnectAfterRefresh);
      socket.off('disconnect', reconnectAfterRefresh);
      socket.disconnect();
    },
  };
}
