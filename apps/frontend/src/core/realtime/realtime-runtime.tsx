import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { io } from 'socket.io-client';
import { getPublicApiUrl } from '@/config/environment';
import { getAccessToken, subscribeAccessToken } from '@/core/api/token-memory';
import { createRealtimeClient, type RealtimeClient, type RealtimeHandler, type RealtimeSocketFactory } from './realtime-client';

const RealtimeContext = createContext<RealtimeClient | null>(null);

const socketIoFactory: RealtimeSocketFactory = (url, options) => io(url, options);

/** Socket.IO answers at the API origin (`/socket.io`), not under the REST prefix. */
function realtimeUrl(): string {
  return new URL(getPublicApiUrl()).origin;
}

export type RealtimeRuntimeProps = PropsWithChildren<{
  createSocket?: RealtimeSocketFactory;
  url?: string;
}>;

/** Opens the authenticated socket for the signed-in area and closes it when the area unmounts. */
export function RealtimeRuntime({ children, createSocket = socketIoFactory, url }: RealtimeRuntimeProps) {
  // Creating the client opens nothing; the effect owns the socket.
  const [client] = useState<RealtimeClient>(() => createRealtimeClient({
    url: url ?? realtimeUrl,
    createSocket,
    getToken: getAccessToken,
    subscribeToken: subscribeAccessToken,
  }));

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>;
}

/** Runs `handler` for every `event` while the component is mounted; outside a RealtimeRuntime it does nothing. */
export function useRealtimeEvent(event: string, handler: RealtimeHandler): void {
  const client = useContext(RealtimeContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => client?.on(event, (payload) => latest.current(payload)), [client, event]);
}
