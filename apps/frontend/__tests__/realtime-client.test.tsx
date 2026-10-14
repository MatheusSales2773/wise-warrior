import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { clearAccessToken, setAccessToken } from '@/core/api/token-memory';
import { createRealtimeClient, type RealtimeSocket, type RealtimeSocketFactory, type RealtimeSocketOptions } from '@/core/realtime/realtime-client';
import { RealtimeRuntime } from '@/core/realtime/realtime-runtime';
import type { ActiveRaid } from '@/features/guild/api';
import { GuildRealtimeEvents } from '@/features/guild/realtime-events';
import { guildKeys } from '@/features/guild/queries';

/** A Socket.IO client stand-in: records listeners and the token of each handshake, and lets the test emit events. */
class FakeSocket implements RealtimeSocket {
  connected = false;
  readonly handshakes: Array<string | null> = [];
  readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(private readonly options: RealtimeSocketOptions) {}

  on(event: string, listener: (payload: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener?: (payload: unknown) => void) {
    if (listener) this.listeners.get(event)?.delete(listener);
    else this.listeners.delete(event);
    return this;
  }

  connect() {
    this.options.auth(({ token }) => this.handshakes.push(token));
    this.connected = true;
    this.emit('connect', undefined);
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  /** Simulates Socket.IO's own reconnection after a network loss: a new handshake on the same socket object. */
  dropAndReconnect() {
    this.connected = false;
    this.connect();
  }

  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }
}

function fakeFactory() {
  const sockets: FakeSocket[] = [];
  const factory: RealtimeSocketFactory = (_url, options) => {
    const socket = new FakeSocket(options);
    sockets.push(socket);
    return socket;
  };
  return { factory, sockets };
}

afterEach(() => clearAccessToken());

describe('createRealtimeClient', () => {
  const tokenSource = () => {
    let token: string | null = 'token-1';
    const listeners = new Set<(next: string | null) => void>();
    return {
      getToken: () => token,
      subscribeToken: (listener: (next: string | null) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      set(next: string | null) {
        token = next;
        listeners.forEach((listener) => listener(next));
      },
    };
  };

  it('connects with the access token and reconnects with the new one after a refresh, without duplicating listeners', () => {
    const { factory, sockets } = fakeFactory();
    const tokens = tokenSource();
    const client = createRealtimeClient({ url: 'http://api.test', createSocket: factory, ...tokens });
    const handler = jest.fn();
    client.on('raid:progress', handler);
    client.start();

    const socket = sockets[0]!;
    expect(socket.handshakes).toEqual(['token-1']);

    tokens.set('token-2');
    socket.dropAndReconnect(); // a network loss after the refresh reuses the current token too
    expect(socket.handshakes).toEqual(['token-1', 'token-2', 'token-2']);
    expect(sockets).toHaveLength(1);
    expect(socket.listenerCount('raid:progress')).toBe(1);

    socket.emit('raid:progress', { raidId: 'r1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('waits for a token before connecting and disconnects on logout', () => {
    const { factory, sockets } = fakeFactory();
    const tokens = tokenSource();
    tokens.set(null);
    const client = createRealtimeClient({ url: 'http://api.test', createSocket: factory, ...tokens });
    client.start();
    expect(sockets[0]!.connected).toBe(false);

    tokens.set('token-1');
    expect(sockets[0]!.connected).toBe(true);
    tokens.set(null);
    expect(sockets[0]!.connected).toBe(false);
    expect(sockets[0]!.handshakes).toEqual(['token-1']);
  });

  it('keeps one socket listener per event and removes it with the last handler, also across restarts', () => {
    const { factory, sockets } = fakeFactory();
    const client = createRealtimeClient({ url: 'http://api.test', createSocket: factory, ...tokenSource() });
    const first = jest.fn();
    const second = jest.fn();
    const offFirst = client.on('raid:progress', first);
    client.on('raid:progress', second);

    client.start();
    client.start();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.listenerCount('raid:progress')).toBe(1);

    client.stop();
    expect(sockets[0]!.listenerCount('raid:progress')).toBe(0);
    client.start();
    expect(sockets[1]!.listenerCount('raid:progress')).toBe(1);

    offFirst();
    sockets[1]!.emit('raid:progress', {});
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('GuildRealtimeEvents', () => {
  const activeRaid: ActiveRaid = {
    id: 'r1',
    mission: { slug: 'cerco-ao-grimorio', name: 'Cerco ao Grimório', description: '', imageUrl: null },
    reward: { itemId: 'i1', name: 'Marcador do Grimório', category: 'badge' },
    goalXp: 1000,
    progressXp: 100,
    goalReachedAt: null,
    startsAt: '2026-10-05T03:00:00Z',
    endsAt: '2026-10-12T02:59:59Z',
    status: 'active',
    me: { participating: true, contributionXp: 100, position: 1 },
  };

  async function renderRuntime() {
    setAccessToken('token-1');
    const { factory, sockets } = fakeFactory();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = await render(
      <QueryClientProvider client={client}>
        <RealtimeRuntime createSocket={factory} url="http://api.test">
          <GuildRealtimeEvents />
        </RealtimeRuntime>
      </QueryClientProvider>,
    );
    return { client, socket: sockets[0]!, view, sockets };
  }

  it('updates the active Raid cache and invalidates the ranking on raid:progress', async () => {
    const { client, socket } = await renderRuntime();
    client.setQueryData(guildKeys.raid('g1'), activeRaid);
    client.setQueryData(guildKeys.raidRanking('g1', 'r1'), { pages: [], pageParams: [] });
    client.setQueryData(guildKeys.raidRanking('g1', 'other'), { pages: [], pageParams: [] });

    await act(async () => socket.emit('raid:progress', { raidId: 'r1', progressXp: 1050, goalXp: 1000, goalReachedAt: '2026-10-08T10:00:00Z' }));

    expect(client.getQueryData(guildKeys.raid('g1'))).toEqual({ ...activeRaid, progressXp: 1050, goalReachedAt: '2026-10-08T10:00:00Z' });
    expect(client.getQueryState(guildKeys.raidRanking('g1', 'r1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(guildKeys.raidRanking('g1', 'other'))?.isInvalidated).toBe(false);
  });

  it('ignores progress of another Raid and malformed payloads', async () => {
    const { client, socket } = await renderRuntime();
    client.setQueryData(guildKeys.raid('g1'), activeRaid);

    await act(async () => {
      socket.emit('raid:progress', { raidId: 'r2', progressXp: 900, goalXp: 1000, goalReachedAt: null });
      socket.emit('raid:progress', { nope: true });
    });

    expect(client.getQueryData(guildKeys.raid('g1'))).toEqual(activeRaid);
  });

  it('follows the access token refresh and closes the socket when the signed-in area unmounts', async () => {
    const { socket, view, sockets } = await renderRuntime();
    expect(socket.handshakes).toEqual(['token-1']);

    await act(async () => setAccessToken('token-2'));
    expect(socket.handshakes).toEqual(['token-1', 'token-2']);
    expect(socket.listenerCount('raid:progress')).toBe(1);

    await view.unmount();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('raid:progress')).toBe(0);
    expect(sockets).toHaveLength(1);
  });
});
