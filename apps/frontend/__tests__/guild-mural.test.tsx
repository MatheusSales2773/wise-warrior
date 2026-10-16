import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform } from 'react-native';
import type { RealtimeAck, RealtimeChannel, RealtimeStatus } from '@/core/realtime/realtime-client';
import { setActiveRealtime } from '@/core/realtime/realtime-store';
import { getActiveRaid, getMyGuild, getRaidRanking, listGuildMembers, listPastRaids, type MyGuild } from '@/features/guild/api';
import type { ChatMessage } from '@/features/guild/guild-chat';
import { GuildScreen } from '@/features/guild/guild-screen';

jest.mock('@/features/dashboard/api', () => ({ getMyProfile: jest.fn(() => Promise.resolve({ id: 'u1', displayName: 'Ana' })) }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
  getRaidRanking: jest.fn(),
  listPastRaids: jest.fn(),
  listGuilds: jest.fn(),
  createGuild: jest.fn(),
  joinGuild: jest.fn(),
  joinRaid: jest.fn(),
  listGuildMembers: jest.fn(),
  leaveGuild: jest.fn(),
}));

const mine: MyGuild = {
  guild: { id: 'g1', name: 'Ordem do Foco', level: 2, memberCount: 3, leader: { userId: 'u1', displayName: 'Ana' } },
  role: 'member',
};

const message = (seq: number, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${seq}`, seq, guildId: 'g1', userId: 'u1', displayName: 'Ana', body: `Mensagem ${seq}`,
  sentAt: new Date(2026, 9, 16, 14, seq).toISOString(), ...overrides,
});

type Handler = (payload: any) => RealtimeAck<object, { retryAfterMs?: number }>;

/** Plays the chat gateway: answers commands from `handlers` and emits room events on demand. */
class FakeGateway implements RealtimeChannel {
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  requests: { event: string; payload: any }[] = [];
  handlers: Record<string, Handler> = {
    'chat:join': () => ({ ok: true, guildId: 'g1', onlineUserIds: ['u1', 'u2'] }),
    'chat:history': () => ({ ok: true, messages: [message(1), message(2, { userId: 'u2', displayName: 'Bruno' })], nextBefore: null }),
  };

  request<T extends object>(event: string, payload: unknown) {
    this.requests.push({ event, payload });
    const handler = this.handlers[event];
    return Promise.resolve((handler ? handler(payload) : { ok: false, error: { code: 'INTERNAL', message: '' } }) as RealtimeAck<T>);
  }
  listen(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => { this.listeners.get(event)?.delete(listener); };
  }
  async emit(event: string, payload: unknown) {
    await act(async () => { this.listeners.get(event)?.forEach((listener) => listener(payload)); });
  }
  sent(event: string) { return this.requests.filter((request) => request.event === event); }
}

let gateway: FakeGateway;
const setStatus = (status: RealtimeStatus) => act(async () => { setActiveRealtime({ channel: gateway, status }); });

async function renderGuild() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><GuildScreen /></QueryClientProvider>);
}

async function openMural() {
  await renderGuild();
  await fireEvent.press(await screen.findByTestId('guild-tab-mural'));
  return screen.findByTestId('guild-mural-messages');
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  Dimensions.set({ window: { width: 390, height: 844, scale: 1, fontScale: 1 } });
  (getMyGuild as jest.Mock).mockResolvedValue(mine);
  (getActiveRaid as jest.Mock).mockResolvedValue(null);
  (getRaidRanking as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
  (listPastRaids as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
  (listGuildMembers as jest.Mock).mockResolvedValue({
    items: [
      { userId: 'u1', displayName: 'Ana', level: 3, title: null, role: 'leader', joinedAt: '2026-09-01T10:00:00Z' },
      { userId: 'u3', displayName: 'Caio', level: 2, title: null, role: 'member', joinedAt: '2026-09-02T10:00:00Z' },
    ],
    nextCursor: null,
  });
  gateway = new FakeGateway();
  setActiveRealtime({ channel: gateway, status: 'connected' });
});
afterEach(async () => { await act(async () => { setActiveRealtime(null); }); jest.clearAllMocks(); });

describe('Guild presence', () => {
  it('shows "N online" from the join and follows member:online', async () => {
    await renderGuild();
    expect(await screen.findByText('2 online')).toBeOnTheScreen();
    expect(gateway.sent('chat:join')[0]?.payload).toEqual({ guildId: 'g1' });

    await gateway.emit('member:online', { guildId: 'g1', userId: 'u3', online: true });
    expect(screen.getByTestId('guild-online-count')).toHaveProp('accessibilityLabel', '3 membros online agora');
    await gateway.emit('member:online', { guildId: 'g1', userId: 'u1', online: false });
    await gateway.emit('member:online', { guildId: 'other', userId: 'u9', online: true });
    expect(screen.getByText('2 online')).toBeOnTheScreen();
  });

  it('marks who is online in the member list', async () => {
    await renderGuild();
    expect(await screen.findByTestId('guild-member-online-u1')).toBeOnTheScreen();
    expect(screen.getByTestId('guild-member-offline-u3')).toBeOnTheScreen();
    await gateway.emit('member:online', { guildId: 'g1', userId: 'u3', online: true });
    expect(screen.getByTestId('guild-member-online-u3')).toBeOnTheScreen();
    expect(screen.getByTestId('guild-member-u3')).toHaveProp('accessibilityLabel', expect.stringContaining('Caio, online'));
  });

  it('stops showing presence while the connection is down', async () => {
    await renderGuild();
    expect(await screen.findByText('2 online')).toBeOnTheScreen();
    await setStatus('reconnecting');
    expect(screen.queryByTestId('guild-online-count')).toBeNull();
  });

  it('hides the count while there is no realtime connection', async () => {
    setActiveRealtime(null);
    await renderGuild();
    expect(await screen.findByTestId('guild-mine')).toBeOnTheScreen();
    expect(screen.queryByTestId('guild-online-count')).toBeNull();
  });
});

describe('Mural', () => {
  it('opens on the Raid tab and switches to the Mural with the latest messages', async () => {
    await renderGuild();
    expect(await screen.findByTestId('guild-tab-raid')).toBeSelected();
    await fireEvent.press(screen.getByTestId('guild-tab-mural'));
    expect(screen.getByTestId('guild-tab-mural')).toBeSelected();
    expect(screen.queryByTestId('guild-raid')).toBeNull();
    const list = await screen.findByTestId('guild-mural-messages');
    expect(within(list).getByText('Mensagem 1')).toBeOnTheScreen();
    expect(within(list).getByText('Bruno')).toBeOnTheScreen();
    expect(screen.getByTestId('guild-mural-message-m2')).toHaveProp('accessibilityLabel', 'Bruno, 14:02: Mensagem 2');
  });

  it('loads older messages', async () => {
    gateway.handlers['chat:history'] = ({ before }) => (before === undefined
      ? { ok: true, messages: [message(5)], nextBefore: 5 }
      : { ok: true, messages: [message(3), message(4)], nextBefore: null });
    await openMural();
    await fireEvent.press(screen.getByTestId('guild-mural-older'));
    expect(await screen.findByText('Mensagem 3')).toBeOnTheScreen();
    expect(gateway.sent('chat:history')[1]?.payload).toEqual({ guildId: 'g1', before: 5 });
    expect(screen.queryByTestId('guild-mural-older')).toBeNull();
    expect(screen.getByText('Início do Mural')).toBeOnTheScreen();
  });

  it('sends a message, shows it once even when the room echoes it', async () => {
    gateway.handlers['chat:send'] = ({ body }) => ({ ok: true, message: message(3, { body }) });
    await openMural();
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a guilda'), 'Bora estudar');
    await fireEvent.press(screen.getByTestId('guild-mural-send'));
    expect(await screen.findByText('Bora estudar')).toBeOnTheScreen();
    expect(gateway.sent('chat:send')[0]?.payload).toEqual({ guildId: 'g1', body: 'Bora estudar' });
    await gateway.emit('chat:message', message(3, { body: 'Bora estudar' }));
    expect(screen.getAllByText('Bora estudar')).toHaveLength(1);
    expect(screen.getByLabelText('Mensagem para a guilda')).toHaveProp('value', '');
  });

  it('shows messages from others as they arrive and announces only those', async () => {
    await openMural();
    const announcer = () => screen.getByTestId('guild-mural-announcer');
    expect(announcer()).toHaveTextContent('');
    await gateway.emit('chat:message', message(3, { userId: 'u2', displayName: 'Bruno', body: 'Cheguei' }));
    expect(screen.getByText('Cheguei')).toBeOnTheScreen();
    expect(announcer()).toHaveTextContent(/^Nova mensagem no Mural de Bruno, .*14:03: Cheguei$/);
    await waitFor(() => expect(screen.getByTestId('guild-online-count')).toBeOnTheScreen());
    await gateway.emit('chat:message', message(4, { body: 'Minha' }));
    expect(announcer()).toHaveTextContent(/Bruno, .*: Cheguei$/);
  });

  it('announces a repeated message again', async () => {
    await openMural();
    await gateway.emit('chat:message', message(3, { userId: 'u2', displayName: 'Bruno', body: 'Oi' }));
    const first = screen.getByTestId('guild-mural-announcer');
    await gateway.emit('chat:message', message(4, { userId: 'u2', displayName: 'Bruno', body: 'Oi', sentAt: message(3).sentAt }));
    const second = screen.getByTestId('guild-mural-announcer');
    expect(second).not.toBe(first);
    expect(second).toHaveTextContent(/Bruno, .*: Oi$/);
  });

  it('announces new messages on the Raid tab too', async () => {
    await renderGuild();
    await screen.findByText('2 online');
    await gateway.emit('chat:message', message(3, { userId: 'u2', displayName: 'Bruno', body: 'Cheguei' }));
    expect(screen.getByTestId('guild-mural-announcer')).toHaveTextContent(/^Nova mensagem no Mural de Bruno, .*: Cheguei$/);
  });

  it('keeps a message that arrives while the first page is loading', async () => {
    let answerHistory!: () => void;
    const original = gateway.request.bind(gateway);
    gateway.request = ((event: string, payload: unknown) => (event === 'chat:history'
      ? new Promise((resolve) => { answerHistory = () => resolve(gateway.handlers['chat:history']!(payload) as never); })
      : original(event, payload))) as typeof gateway.request;
    await renderGuild();
    await waitFor(() => expect(answerHistory).toBeDefined());
    await gateway.emit('chat:message', message(3, { body: 'No meio' }));
    await act(async () => { answerHistory(); });
    await fireEvent.press(screen.getByTestId('guild-tab-mural'));
    expect(screen.getByText('No meio')).toBeOnTheScreen();
    expect(screen.getByText('Mensagem 1')).toBeOnTheScreen();
  });

  it('sends blank messages to the server and shows its refusal', async () => {
    gateway.handlers['chat:send'] = () => ({ ok: false, error: { code: 'EMPTY', message: 'EMPTY' } });
    await openMural();
    await fireEvent.press(screen.getByTestId('guild-mural-send'));
    expect(await screen.findByText('Escreva algo antes de enviar.')).toBeOnTheScreen();
    expect(gateway.sent('chat:send')[0]?.payload).toEqual({ guildId: 'g1', body: '' });
  });

  it('says when missed messages could not be recovered and tries again', async () => {
    gateway.handlers['chat:sync'] = () => ({ ok: false, error: { code: 'INTERNAL', message: '' } });
    await openMural();
    await setStatus('reconnecting');
    await setStatus('connected');
    expect(await screen.findByTestId('guild-mural-sync-error')).toBeOnTheScreen();
    gateway.handlers['chat:sync'] = () => ({ ok: true, messages: [message(3, { body: 'Recuperada' })], truncated: false, onlineUserIds: ['u1'] });
    await fireEvent.press(screen.getByTestId('guild-mural-resync'));
    expect(await screen.findByText('Recuperada')).toBeOnTheScreen();
    expect(screen.queryByTestId('guild-mural-sync-error')).toBeNull();
    expect(gateway.sent('chat:join')).toHaveLength(1);
  });

  it('shows why a message was refused and keeps the draft', async () => {
    gateway.handlers['chat:send'] = () => ({ ok: false, error: { code: 'RATE_LIMITED', message: 'RATE_LIMITED', retryAfterMs: 4200 } });
    await openMural();
    await fireEvent.changeText(screen.getByLabelText('Mensagem para a guilda'), 'oi');
    await fireEvent.press(screen.getByTestId('guild-mural-send'));
    expect(await screen.findByText('Você enviou muitas mensagens seguidas. Espere 5 s e tente de novo.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mensagem para a guilda')).toHaveProp('value', 'oi');
  });

  it('recovers missed messages after a reconnection without duplicates', async () => {
    gateway.handlers['chat:sync'] = () => ({ ok: true, messages: [message(2, { userId: 'u2', displayName: 'Bruno' }), message(3, { body: 'Perdida' })], truncated: false, onlineUserIds: ['u2'] });
    await openMural();
    await setStatus('reconnecting');
    expect(screen.getByTestId('guild-mural-reconnecting')).toBeOnTheScreen();
    expect(screen.getByTestId('guild-mural-send')).toBeDisabled();
    await setStatus('connected');
    expect(await screen.findByText('Perdida')).toBeOnTheScreen();
    expect(gateway.sent('chat:sync')[0]?.payload).toEqual({ guildId: 'g1', afterSeq: 2 });
    expect(screen.getAllByText('Mensagem 2')).toHaveLength(1);
    expect(screen.getByText('1 online')).toBeOnTheScreen();
    expect(gateway.sent('chat:join')).toHaveLength(1);
  });

  it('reloads the latest page when the sync was truncated', async () => {
    gateway.handlers['chat:sync'] = () => ({ ok: true, messages: [], truncated: true, onlineUserIds: [] });
    await openMural();
    gateway.handlers['chat:history'] = () => ({ ok: true, messages: [message(300, { body: 'Recente' })], nextBefore: 300 });
    await setStatus('reconnecting');
    await setStatus('connected');
    expect(await screen.findByText('Recente')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Mensagem 1')).toBeNull());
  });
  it('keeps asking for the gap when live messages arrive before a failed sync is retried', async () => {
    gateway.handlers['chat:sync'] = () => ({ ok: false, error: { code: 'INTERNAL', message: '' } });
    await openMural();
    await setStatus('reconnecting');
    await setStatus('connected');
    expect(await screen.findByTestId('guild-mural-sync-error')).toBeOnTheScreen();
    await gateway.emit('chat:message', message(9, { userId: 'u2', displayName: 'Bruno', body: 'Ao vivo' }));
    gateway.handlers['chat:sync'] = () => ({ ok: true, messages: [message(5, { body: 'No buraco' }), message(9, { userId: 'u2', displayName: 'Bruno', body: 'Ao vivo' })], truncated: false, onlineUserIds: ['u1'] });
    await fireEvent.press(screen.getByTestId('guild-mural-resync'));
    expect(await screen.findByText('No buraco')).toBeOnTheScreen();
    expect(gateway.sent('chat:sync').map((request) => request.payload.afterSeq)).toEqual([2, 2]);
    await setStatus('reconnecting');
    await setStatus('connected');
    await waitFor(() => expect(gateway.sent('chat:sync')).toHaveLength(3));
    expect(gateway.sent('chat:sync')[2]?.payload.afterSeq).toBe(9);
  });

  it('retries a failed older page from the button', async () => {
    let fail = true;
    gateway.handlers['chat:history'] = ({ before }) => (before === undefined
      ? { ok: true, messages: [message(5)], nextBefore: 5 }
      : fail ? { ok: false, error: { code: 'INTERNAL', message: '' } } : { ok: true, messages: [message(4)], nextBefore: null });
    await openMural();
    await fireEvent.press(screen.getByTestId('guild-mural-older'));
    fail = false;
    await fireEvent.press(await screen.findByTestId('guild-mural-older-retry'));
    expect(await screen.findByText('Mensagem 4')).toBeOnTheScreen();
  });
  it('drops an older page that arrives after a truncated sync reloaded the latest one', async () => {
    let answerOlder!: () => void;
    gateway.handlers['chat:history'] = ({ before }) => (before === undefined
      ? { ok: true, messages: [message(5)], nextBefore: 5 }
      : { ok: true, messages: [message(4, { body: 'Velha' })], nextBefore: null });
    gateway.handlers['chat:sync'] = () => ({ ok: true, messages: [], truncated: true, onlineUserIds: [] });
    const original = gateway.request.bind(gateway);
    gateway.request = ((event: string, payload: any) => (event === 'chat:history' && payload.before !== undefined
      ? original(event, payload).then((answer) => new Promise<unknown>((resolve) => { answerOlder = () => resolve(answer); }))
      : original(event, payload))) as typeof gateway.request;
    await openMural();
    await fireEvent.press(screen.getByTestId('guild-mural-older'));
    gateway.handlers['chat:history'] = () => ({ ok: true, messages: [message(300, { body: 'Recente' })], nextBefore: 300 });
    await setStatus('reconnecting');
    await setStatus('connected');
    expect(await screen.findByText('Recente')).toBeOnTheScreen();
    await act(async () => { answerOlder(); });
    expect(screen.queryByText('Velha')).toBeNull();
    expect(screen.getByTestId('guild-mural-older')).toBeOnTheScreen();
  });

  it('asks for an older page once while it is on its way', async () => {
    gateway.handlers['chat:history'] = ({ before }) => (before === undefined
      ? { ok: true, messages: [message(5)], nextBefore: 5 }
      : { ok: true, messages: [message(4)], nextBefore: null });
    const original = gateway.request.bind(gateway);
    gateway.request = ((event: string, payload: any) => (event === 'chat:history' && payload.before !== undefined
      ? (original(event, payload), new Promise(() => {}))
      : original(event, payload))) as typeof gateway.request;
    await openMural();
    const older = screen.getByTestId('guild-mural-older');
    await Promise.all([fireEvent.press(older), fireEvent.press(older), fireEvent.press(older)]);
    expect(gateway.sent('chat:history').filter((request) => request.payload.before !== undefined)).toHaveLength(1);
  });
});
