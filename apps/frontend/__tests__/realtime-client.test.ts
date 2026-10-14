import { QueryClient } from '@tanstack/react-query';
import { createRealtimeClient, type RealtimeSocket, type RealtimeSocketFactory } from '@/core/realtime/realtime-client';
import type { ActiveRaid } from '@/features/guild/api';
import { guildKeys } from '@/features/guild/queries';

class FakeSocket implements RealtimeSocket {
  active = true;
  connectCalls = 0;
  disconnectCalls = 0;
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  auth!: (callback: (data: { token: string | null }) => void) => void;

  on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }
  off(event: string, listener?: (...args: any[]) => void) {
    if (listener) this.listeners.get(event)?.delete(listener);
    else this.listeners.delete(event);
  }
  connect() { this.connectCalls += 1; }
  disconnect() { this.disconnectCalls += 1; }
  emit(event: string, ...args: unknown[]) { this.listeners.get(event)?.forEach((listener) => listener(...args)); }
  count(event: string) { return this.listeners.get(event)?.size ?? 0; }
  handshakeToken() {
    let token: string | null | undefined;
    this.auth((data) => { token = data.token; });
    return token;
  }
}

const raid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'raid-1',
  mission: { slug: 'cerco', name: 'Cerco', description: '', imageUrl: null },
  reward: { itemId: 'item-1', name: 'Marcador', category: 'badge' },
  goalXp: 1000,
  progressXp: 100,
  goalReachedAt: null,
  startsAt: '2026-10-05T03:00:00.000Z',
  endsAt: '2026-10-12T02:59:59.000Z',
  status: 'active',
  me: { participating: true, contributionXp: 100, position: 1 },
  ...overrides,
});

function setup(token: string | null = 'token-1') {
  const socket = new FakeSocket();
  const queryClient = new QueryClient();
  const state = { token };
  const recover = jest.fn(() => Promise.resolve({ status: 'authenticated' } as const));
  const createSocket: RealtimeSocketFactory = jest.fn((_url, options) => {
    socket.auth = options.auth;
    return socket;
  });
  const client = createRealtimeClient({ url: 'http://api.test', queryClient, getToken: () => state.token, recover, createSocket });
  return { socket, queryClient, state, recover, createSocket, client };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('realtime client', () => {
  it('connects with the access token read at handshake time', () => {
    const { socket, state, createSocket } = setup('token-1');

    expect(createSocket).toHaveBeenCalledWith('http://api.test', expect.objectContaining({ transports: ['websocket'] }));
    expect(socket.connectCalls).toBe(1);
    expect(socket.handshakeToken()).toBe('token-1');
    state.token = 'token-2';
    expect(socket.handshakeToken()).toBe('token-2');
  });

  it('updates the cached active Raid and invalidates the Ranking interno on raid:progress', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(guildKeys.raid('guild-1'), raid());
    queryClient.setQueryData(guildKeys.raidRanking('guild-1', 'raid-1'), { pages: [], pageParams: [] });
    queryClient.setQueryData(guildKeys.raid('guild-2'), raid({ id: 'raid-other', progressXp: 5 }));

    socket.emit('raid:progress', { raidId: 'raid-1', progressXp: 450, goalXp: 1000, goalReachedAt: null });

    expect(queryClient.getQueryData<ActiveRaid>(guildKeys.raid('guild-1'))).toMatchObject({ progressXp: 450, me: { contributionXp: 100 } });
    expect(queryClient.getQueryData<ActiveRaid>(guildKeys.raid('guild-2'))?.progressXp).toBe(5);
    expect(queryClient.getQueryState(guildKeys.raidRanking('guild-1', 'raid-1'))?.isInvalidated).toBe(true);
  });

  it('shows Meta batida when the event carries goalReachedAt', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(guildKeys.raid('guild-1'), raid());

    socket.emit('raid:progress', { raidId: 'raid-1', progressXp: 1000, goalXp: 1000, goalReachedAt: '2026-10-08T12:00:00.000Z' });

    expect(queryClient.getQueryData<ActiveRaid>(guildKeys.raid('guild-1'))?.goalReachedAt).toBe('2026-10-08T12:00:00.000Z');
  });

  it('refreshes the token and reconnects once when the server rejects the handshake, without duplicating listeners', async () => {
    const { socket, state, recover } = setup('expired');
    recover.mockImplementation(async () => {
      state.token = 'fresh';
      return { status: 'authenticated' } as const;
    });

    socket.active = false; // Socket.IO stops retrying after a middleware rejection
    socket.emit('connect_error', new Error('Unauthorized'));
    await flush();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(socket.connectCalls).toBe(2);
    expect(socket.handshakeToken()).toBe('fresh');
    expect(socket.count('raid:progress')).toBe(1);
    expect(socket.count('connect_error')).toBe(1);
    expect(socket.count('disconnect')).toBe(1);
  });

  it('refetches the Raid and its ranking after a reconnection, but not on the first connection', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(guildKeys.raid('guild-1'), raid());
    queryClient.setQueryData(guildKeys.members('guild-1'), { pages: [], pageParams: [] });

    socket.emit('connect');
    expect(queryClient.getQueryState(guildKeys.raid('guild-1'))?.isInvalidated).toBe(false);
    socket.emit('connect');

    expect(queryClient.getQueryState(guildKeys.raid('guild-1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(guildKeys.members('guild-1'))?.isInvalidated).toBe(false);
  });

  it('starts one recovery for a burst of failures', async () => {
    const { socket, recover } = setup();
    socket.active = false;

    socket.emit('connect_error', new Error('Unauthorized'));
    socket.emit('disconnect', 'io server disconnect');
    await flush();

    expect(recover).toHaveBeenCalledTimes(1);
    expect(socket.connectCalls).toBe(2);
  });

  it('leaves Socket.IO to retry on its own after a network drop', async () => {
    const { socket, recover } = setup();

    socket.active = true;
    socket.emit('disconnect', 'transport close');
    socket.emit('connect_error', new Error('xhr poll error'));
    await flush();

    expect(recover).not.toHaveBeenCalled();
    expect(socket.connectCalls).toBe(1);
  });

  it('stays disconnected when the Session could not be recovered', async () => {
    const { socket, recover } = setup();
    recover.mockResolvedValue({ status: 'anonymous' } as never);

    socket.active = false;
    socket.emit('disconnect', 'io server disconnect');
    await flush();

    expect(socket.connectCalls).toBe(1);
  });

  it('removes its listeners and disconnects on dispose, and ignores a recovery that finishes afterwards', async () => {
    const { socket, client, recover } = setup();
    let finish!: () => void;
    recover.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ status: 'authenticated' } as never); }));
    socket.active = false;
    socket.emit('connect_error', new Error('Unauthorized'));

    client.dispose();
    finish();
    await flush();

    expect(socket.disconnectCalls).toBe(1);
    expect(socket.count('raid:progress')).toBe(0);
    expect(socket.connectCalls).toBe(1);
  });
});
