import { QueryClient } from '@tanstack/react-query';
import { createRealtimeClient, type RealtimeSocket, type RealtimeSocketFactory } from '@/core/realtime/realtime-client';
import type { ActiveRaid } from '@/features/guild/api';
import { dashboardKeys } from '@/features/dashboard/queries';
import { guildKeys } from '@/features/guild/queries';
import { profileKeys } from '@/features/profile/queries';
import { marketKeys } from '@/features/market/queries';

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
  /** Commands the client sent, with the ack callback the server would call. */
  commands: { event: string; payload: unknown; ack: (answer: unknown) => void }[] = [];
  /** Plays the server: delivers an event to the client's listeners, or records a command that carries an ack. */
  emit(event: string, ...args: unknown[]) {
    const ack = args.at(-1);
    if (args.length === 2 && typeof ack === 'function') {
      this.commands.push({ event, payload: args[0], ack: ack as (answer: unknown) => void });
      return;
    }
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
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

describe('notification:raidComplete', () => {
  it('invalidates the active Raid, the past Raids, the Guild and the cosmetics catalog, and nothing else', async () => {
    const { socket, queryClient, client } = setup();
    const keys = [
      guildKeys.raid('guild-1'),
      guildKeys.pastRaids('guild-1'),
      guildKeys.mine(),
      profileKeys.cosmeticsCatalog(),
      profileKeys.devices(),
    ];
    keys.forEach((key) => queryClient.setQueryData(key, {}));

    socket.emit('notification:raidComplete', { raidId: 'raid-1', guildId: 'guild-1', status: 'completed', rewardItemId: 'item-1' });
    await flush();

    const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(invalidated(guildKeys.raid('guild-1'))).toBe(true);
    expect(invalidated(guildKeys.pastRaids('guild-1'))).toBe(true);
    expect(invalidated(guildKeys.mine())).toBe(true);
    expect(invalidated(profileKeys.cosmeticsCatalog())).toBe(true);
    expect(invalidated(profileKeys.devices())).toBe(false);

    client.dispose();
    expect(socket.count('notification:raidComplete')).toBe(0);
  });
});

describe('progress:xpUpdated and notification:levelup', () => {
  const seed = (queryClient: QueryClient) => {
    [dashboardKeys.profile(), dashboardKeys.recentActivity(), dashboardKeys.metrics(), profileKeys.cosmeticsCatalog(), profileKeys.devices()]
      .forEach((key) => queryClient.setQueryData(key, {}));
  };
  const invalidated = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

  it('refreshes the Dashboard and Personagem data when XP is earned on another device', () => {
    const { socket, queryClient } = setup();
    seed(queryClient);

    socket.emit('progress:xpUpdated', { xpGained: 50, xpTotal: 150, level: 1 });

    expect(invalidated(queryClient, dashboardKeys.profile())).toBe(true);
    expect(invalidated(queryClient, dashboardKeys.recentActivity())).toBe(true);
    expect(invalidated(queryClient, dashboardKeys.metrics())).toBe(true);
    expect(invalidated(queryClient, profileKeys.cosmeticsCatalog())).toBe(false);
  });

  it('also refreshes the cosmetics catalog on a level-up', () => {
    const { socket, queryClient } = setup();
    seed(queryClient);

    socket.emit('notification:levelup', { previousLevel: 1, newLevel: 2 });

    expect(invalidated(queryClient, dashboardKeys.profile())).toBe(true);
    expect(invalidated(queryClient, profileKeys.cosmeticsCatalog())).toBe(true);
    expect(invalidated(queryClient, profileKeys.devices())).toBe(false);
  });

  it('registers each listener once and removes it on dispose', () => {
    const { socket, client } = setup();
    expect(socket.count('progress:xpUpdated')).toBe(1);
    expect(socket.count('notification:levelup')).toBe(1);

    client.dispose();

    expect(socket.count('progress:xpUpdated')).toBe(0);
    expect(socket.count('notification:levelup')).toBe(0);
  });
});

describe('connection status', () => {
  it('walks connecting, connected, reconnecting and connected again, notifying subscribers', () => {
    const { socket, client } = setup();
    const seen: string[] = [];
    client.subscribe(() => seen.push(client.getStatus()));
    expect(client.getStatus()).toBe('connecting');

    socket.emit('connect');
    socket.active = true;
    socket.emit('disconnect', 'transport close');
    socket.emit('connect');

    expect(seen).toEqual(['connected', 'reconnecting', 'connected']);
  });

  it('is offline when the Session cannot be recovered, and reconnecting while a recovery runs', async () => {
    const { socket, client, recover } = setup();
    recover.mockResolvedValue({ status: 'anonymous' } as never);
    socket.active = false;

    socket.emit('disconnect', 'io server disconnect');
    expect(client.getStatus()).toBe('reconnecting');
    await flush();

    expect(client.getStatus()).toBe('offline');
  });

  it('keeps one listener per event across reconnections', () => {
    const { socket } = setup();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      socket.active = true;
      socket.emit('disconnect', 'transport close');
      socket.emit('connect');
    }

    ['raid:progress', 'notification:raidComplete', 'progress:xpUpdated', 'notification:levelup', 'connect', 'connect_error', 'disconnect']
      .forEach((event) => expect(socket.count(event)).toBe(1));
  });

  it('stops notifying after unsubscribe', () => {
    const { socket, client } = setup();
    const listener = jest.fn();
    client.subscribe(listener)();

    socket.emit('connect');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('character:equipmentChanged', () => {
  const invalidated = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

  it('refreshes the profile and the cosmetics catalog when another device changes the equipment', () => {
    const { socket, queryClient } = setup();
    [dashboardKeys.profile(), dashboardKeys.metrics(), profileKeys.cosmeticsCatalog(), profileKeys.devices()]
      .forEach((key) => queryClient.setQueryData(key, {}));

    socket.emit('character:equipmentChanged', { category: 'title', cosmeticItemId: 'item-9' });

    expect(invalidated(queryClient, dashboardKeys.profile())).toBe(true);
    expect(invalidated(queryClient, profileKeys.cosmeticsCatalog())).toBe(true);
    expect(invalidated(queryClient, dashboardKeys.metrics())).toBe(false);
    expect(invalidated(queryClient, profileKeys.devices())).toBe(false);
  });

  it('registers the listener once and removes it on dispose', () => {
    const { socket, client } = setup();
    expect(socket.count('character:equipmentChanged')).toBe(1);

    client.dispose();

    expect(socket.count('character:equipmentChanged')).toBe(0);
  });
});

describe('coins:changed', () => {
  const invalidated = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

  it('applies the new balance at once and refreshes the Extrato and the Loja', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(marketKeys.balance(), 12);
    [marketKeys.statement(), marketKeys.missions(), marketKeys.items(), profileKeys.cosmeticsCatalog()].forEach((key) => queryClient.setQueryData(key, {}));

    socket.emit('coins:changed', { balance: 24, delta: 12, origin: { type: 'study-session', ref: 's1' } });

    expect(queryClient.getQueryData(marketKeys.balance())).toBe(24);
    expect(invalidated(queryClient, marketKeys.statement())).toBe(true);
    expect(invalidated(queryClient, marketKeys.missions())).toBe(true);
    expect(invalidated(queryClient, marketKeys.items())).toBe(true);
    expect(invalidated(queryClient, profileKeys.cosmeticsCatalog())).toBe(false);
  });

  it('refreshes the Inventário when an item was bought on another device', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(profileKeys.cosmeticsCatalog(), []);

    socket.emit('coins:changed', { balance: 12, delta: -120, origin: { type: 'purchase', ref: 'cosmetic:i1' } });

    expect(invalidated(queryClient, profileKeys.cosmeticsCatalog())).toBe(true);
  });

  it('registers the listener once and removes it on dispose', () => {
    const { socket, client } = setup();
    expect(socket.count('coins:changed')).toBe(1);

    client.dispose();

    expect(socket.count('coins:changed')).toBe(0);
  });
});

describe('chat channel on the same socket', () => {
  it('answers a command with the gateway ack once connected, and refuses while disconnected', async () => {
    const { socket, client } = setup();
    await expect(client.request('chat:join', { guildId: 'g1' })).resolves.toEqual({ ok: false, error: { code: 'DISCONNECTED', message: 'Sem conexão' } });
    socket.emit('connect');
    const answer = client.request('chat:join', { guildId: 'g1' });
    expect(socket.commands.map(({ event, payload }) => [event, payload])).toEqual([['chat:join', { guildId: 'g1' }]]);
    socket.commands[0]!.ack({ ok: true, onlineUserIds: ['u1'] });
    await expect(answer).resolves.toEqual({ ok: true, onlineUserIds: ['u1'] });
  });

  it('fails a command in flight as soon as the connection drops', async () => {
    const { socket, client } = setup();
    socket.emit('connect');
    const answer = client.request('chat:send', { guildId: 'g1', body: 'oi' });
    socket.emit('disconnect');
    await expect(answer).resolves.toEqual({ ok: false, error: { code: 'DISCONNECTED', message: 'Sem conexão' } });
  });

  it('lets screens listen to room events and stop listening', () => {
    const { socket, client } = setup();
    const listener = jest.fn();
    const stop = client.listen('member:online', listener);
    socket.emit('member:online', { userId: 'u1' });
    stop();
    socket.emit('member:online', { userId: 'u2' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
