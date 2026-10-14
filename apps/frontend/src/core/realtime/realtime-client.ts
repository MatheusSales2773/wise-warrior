/** The part of a Socket.IO 4.x client socket the app uses; tests provide a fake one. */
export interface RealtimeSocket {
  readonly connected: boolean;
  on(event: string, listener: (payload: unknown) => void): unknown;
  off(event: string, listener?: (payload: unknown) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export type RealtimeSocketOptions = {
  autoConnect: false;
  transports: string[];
  /** Read again on every (re)connection attempt, so a reconnect always carries the current access token. */
  auth: (callback: (data: { token: string | null }) => void) => void;
};

export type RealtimeSocketFactory = (url: string, options: RealtimeSocketOptions) => RealtimeSocket;

export type RealtimeHandler = (payload: unknown) => void;

export interface RealtimeClient {
  /** Adds a handler; the returned function removes it. The socket keeps one listener per event, however many handlers. */
  on(event: string, handler: RealtimeHandler): () => void;
  /** Opens the socket (once a token exists) and follows token changes until `stop`. */
  start(): void;
  stop(): void;
}

export type RealtimeClientOptions = {
  /** Resolved on `start`, so a missing configuration only leaves the app without realtime (REST still works). */
  url: string | (() => string);
  createSocket: RealtimeSocketFactory;
  getToken: () => string | null;
  subscribeToken: (listener: (token: string | null) => void) => () => void;
};

/**
 * One authenticated socket per runtime (ADR-009). The server authenticates only at the handshake, so a new
 * access token (refresh, login or logout) reconnects the socket with it. A network loss reconnects on its own
 * (Socket.IO backoff) with the current token. Handlers are kept here and attached once per socket, so
 * reconnecting or restarting never registers them twice.
 */
export function createRealtimeClient({ url, createSocket, getToken, subscribeToken }: RealtimeClientOptions): RealtimeClient {
  const handlers = new Map<string, Set<RealtimeHandler>>();
  const dispatchers = new Map<string, RealtimeHandler>();
  let socket: RealtimeSocket | null = null;
  let unsubscribe: (() => void) | null = null;

  const dispatcherFor = (event: string): RealtimeHandler => {
    let dispatch = dispatchers.get(event);
    if (!dispatch) {
      dispatch = (payload) => handlers.get(event)?.forEach((handler) => handler(payload));
      dispatchers.set(event, dispatch);
    }
    return dispatch;
  };

  return {
    on(event, handler) {
      let eventHandlers = handlers.get(event);
      if (!eventHandlers) {
        eventHandlers = new Set();
        handlers.set(event, eventHandlers);
        socket?.on(event, dispatcherFor(event));
      }
      const registered = eventHandlers;
      registered.add(handler);
      return () => {
        registered.delete(handler);
        if (registered.size > 0 || handlers.get(event) !== registered) return;
        handlers.delete(event);
        socket?.off(event, dispatchers.get(event));
        dispatchers.delete(event);
      };
    },
    start() {
      if (socket) return;
      let resolvedUrl: string;
      try {
        resolvedUrl = typeof url === 'function' ? url() : url;
      } catch (error) {
        if (__DEV__) console.warn('Tempo real desativado: URL da API indisponível.', error);
        return;
      }
      const opened = createSocket(resolvedUrl, {
        autoConnect: false,
        transports: ['websocket'],
        auth: (callback) => callback({ token: getToken() }),
      });
      socket = opened;
      handlers.forEach((_, event) => opened.on(event, dispatcherFor(event)));
      let currentToken = getToken();
      if (currentToken) opened.connect();
      unsubscribe = subscribeToken((token) => {
        if (token === currentToken) return;
        currentToken = token;
        opened.disconnect();
        if (token) opened.connect();
      });
    },
    stop() {
      const opened = socket;
      if (!opened) return;
      socket = null;
      unsubscribe?.();
      unsubscribe = null;
      dispatchers.forEach((dispatch, event) => opened.off(event, dispatch));
      opened.disconnect();
    },
  };
}
