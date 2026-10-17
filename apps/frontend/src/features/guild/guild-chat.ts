import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_DISCONNECTED, type RealtimeAck, type RealtimeChannel, type RealtimeStatus } from '@/core/realtime/realtime-client';
import { useActiveRealtime } from '@/core/realtime/realtime-store';
import { chatErrorMessage } from './messages';

/**
 * A Mural message as the chat gateway sends it (`ChatMessageView`). `raid_hit` is an Aviso do Mural: no human wrote
 * it, `userId`/`displayName` are the Golpe's author, `xp` its damage and `body` is empty.
 */
export type ChatMessage = {
  id: string; seq: number; guildId: string; userId: string; displayName: string;
  kind: 'message' | 'raid_hit'; xp: number | null; body: string; sentAt: string;
};

/** "Ravenstone causou 75 de dano": the text of an Aviso, built with the author's current name. */
export function raidHitText(message: Pick<ChatMessage, 'displayName' | 'xp'>): string {
  return `${message.displayName} causou ${message.xp ?? 0} de dano`;
}
type ChatPage = { messages: ChatMessage[]; nextBefore: number | null };
/** `chat:send` refusals for sending too fast say when to try again. */
type ChatErrorFields = { retryAfterMs?: number };
export type ChatAckError = Extract<RealtimeAck<object, ChatErrorFields>, { ok: false }>['error'];

/** The chat gateway's commands (payload, then the answer's fields) and room events, as `chat.gateway.ts` defines them. */
type ChatCommands = {
  'chat:join': [{ guildId: string }, { onlineUserIds: string[] }];
  'chat:history': [{ guildId: string; before?: number }, ChatPage];
  'chat:sync': [{ guildId: string; afterSeq: number }, { messages: ChatMessage[]; truncated: boolean; onlineUserIds: string[] }];
  'chat:send': [{ guildId: string; body: string }, { message: ChatMessage }];
};
type ChatEvents = {
  'chat:message': ChatMessage;
  'member:online': { guildId: string; userId: string; online: boolean };
};

function requestChat<K extends keyof ChatCommands>(channel: RealtimeChannel, event: K, payload: ChatCommands[K][0]) {
  return channel.request<ChatCommands[K][1]>(event, payload) as Promise<RealtimeAck<ChatCommands[K][1], ChatErrorFields>>;
}

function listenChat<K extends keyof ChatEvents>(channel: RealtimeChannel, event: K, listener: (payload: ChatEvents[K]) => void) {
  return channel.listen(event, listener);
}

/** Keeps one copy of each message (by `id`), in `seq` order. */
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): readonly ChatMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

function highestSeq(messages: readonly ChatMessage[], floor: number): number {
  return messages.reduce((highest, message) => Math.max(highest, message.seq), floor);
}

export type SendResult = { ok: true } | { ok: false; message: string };

export type GuildChat = {
  /** `null` until the first join answers; presence is unknown then. */
  onlineUserIds: ReadonlySet<string> | null;
  messages: readonly ChatMessage[];
  /** The latest message another member sent while the Mural was open, for screen readers. */
  arrival: ChatMessage | null;
  status: 'loading' | 'ready' | 'error';
  /** Recovering what was missed after a reconnection failed; `resync` tries again. */
  syncFailed: boolean;
  connection: RealtimeStatus | 'unavailable';
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  loadOlder(): void;
  retry(): void;
  resync(): void;
  send(body: string): Promise<SendResult>;
};

/**
 * The Guild's presence and Mural on the Session's socket (no second connection). Joins once connected, keeps
 * `member:online` and `chat:message` up to date and, after a reconnection, asks `chat:sync` for what it missed.
 * Mount it per Guild (`key={guildId}`): state starts fresh with each one. `myUserId` keeps the member's own
 * messages out of the screen-reader announcements.
 */
export function useGuildChat(guildId: string, myUserId?: string): GuildChat {
  const realtime = useActiveRealtime();
  const channel = realtime?.channel ?? null;
  const connected = realtime?.status === 'connected';
  const [online, setOnline] = useState<Set<string> | null>(null);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [arrival, setArrival] = useState<ChatMessage | null>(null);
  const [status, setStatus] = useState<GuildChat['status']>('loading');
  const [syncFailed, setSyncFailed] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // What a reconnection asks `chat:sync` to continue from: the end of the unbroken run of messages held. Live
  // messages move it only while nothing is missing, so one that arrives before a failed sync is retried can't
  // skip the gap.
  const lastSeq = useRef(0);
  const gap = useRef(false);
  const heldSeq = useRef(0);
  const joined = useRef(false);
  const myUserIdRef = useRef(myUserId);
  useEffect(() => { myUserIdRef.current = myUserId; }, [myUserId]);
  // Bumped when a truncated sync drops the older pages: an older page asked for before that is stale on arrival.
  const historyEpoch = useRef(0);
  // Set synchronously, so scroll events that come before the `loadingOlder` render can't ask twice.
  const olderInFlight = useRef(false);

  const receive = useCallback((incoming: readonly ChatMessage[]) => {
    if (gap.current) heldSeq.current = highestSeq(incoming, heldSeq.current);
    else lastSeq.current = highestSeq(incoming, lastSeq.current);
    setMessages((current) => mergeMessages(current, incoming));
  }, []);

  useEffect(() => {
    if (!channel) return;
    const offMessage = listenChat(channel, 'chat:message', (message) => {
      if (message.guildId !== guildId) return;
      receive([message]);
      // Nobody typed an Aviso, so the member's own Golpe is announced too.
      if (message.kind === 'raid_hit' || message.userId !== myUserIdRef.current) setArrival(message);
    });
    const offOnline = listenChat(channel, 'member:online', (event) => {
      if (event.guildId !== guildId) return;
      setOnline((current) => {
        const next = new Set(current ?? []);
        if (event.online) next.add(event.userId);
        else next.delete(event.userId);
        return next;
      });
    });
    return () => { offMessage(); offOnline(); };
  }, [channel, guildId, receive]);

  // On every (re)connection: the first one joins and loads the latest page, later ones recover what was missed.
  useEffect(() => {
    if (!channel || !connected) return;
    let cancelled = false;
    /** `restart`: the server no longer has what came between, so older pages already shown are dropped. */
    const loadLatest = async (restart: boolean) => {
      const page = await requestChat(channel, 'chat:history', { guildId });
      if (cancelled) return false;
      if (!page.ok) return false;
      if (restart) historyEpoch.current += 1;
      const pageEnd = highestSeq(page.messages, 0);
      lastSeq.current = restart ? highestSeq(page.messages, 0) : highestSeq(page.messages, lastSeq.current);
      // Messages that arrived while the page was on its way are kept, never overwritten.
      setMessages((current) => mergeMessages(restart ? current.filter((message) => message.seq > pageEnd) : current, page.messages));
      setNextBefore(page.nextBefore);
      return true;
    };
    void (async () => {
      if (!joined.current) {
        const join = await requestChat(channel, 'chat:join', { guildId });
        if (cancelled) return;
        if (!join.ok) { setStatus('error'); return; }
        setOnline(new Set(join.onlineUserIds));
        const ok = await loadLatest(false);
        if (cancelled) return;
        joined.current = ok;
        setStatus(ok ? 'ready' : 'error');
        return;
      }
      gap.current = true;
      const sync = await requestChat(channel, 'chat:sync', { guildId, afterSeq: lastSeq.current });
      if (cancelled) return;
      if (!sync.ok) { setSyncFailed(true); return; }
      setOnline(new Set(sync.onlineUserIds));
      const ok = sync.truncated ? await loadLatest(true) : (receive(sync.messages), true);
      if (cancelled) return;
      if (ok) {
        // The gap is closed, so the live messages held back from the cursor are contiguous now.
        gap.current = false;
        lastSeq.current = Math.max(lastSeq.current, heldSeq.current);
      }
      setSyncFailed(!ok);
    })();
    return () => { cancelled = true; };
  }, [channel, connected, guildId, attempt, receive]);

  const loadOlder = useCallback(() => {
    if (!channel || nextBefore === null || olderInFlight.current) return;
    olderInFlight.current = true;
    const epoch = historyEpoch.current;
    setLoadingOlder(true);
    setOlderError(false);
    void requestChat(channel, 'chat:history', { guildId, before: nextBefore }).then((page) => {
      if (epoch !== historyEpoch.current) return;
      if (page.ok) {
        setMessages((current) => mergeMessages(current, page.messages));
        setNextBefore(page.nextBefore);
      } else setOlderError(true);
    }).finally(() => { olderInFlight.current = false; setLoadingOlder(false); });
  }, [channel, guildId, nextBefore]);

  const send = useCallback(async (body: string): Promise<SendResult> => {
    if (!channel) return { ok: false, message: chatErrorMessage(REALTIME_DISCONNECTED) };
    const ack = await requestChat(channel, 'chat:send', { guildId, body });
    if (!ack.ok) return { ok: false, message: chatErrorMessage(ack.error) };
    receive([ack.message]);
    return { ok: true };
  }, [channel, guildId, receive]);

  const retry = useCallback(() => { joined.current = false; setStatus('loading'); setAttempt((value) => value + 1); }, []);
  const resync = useCallback(() => { setSyncFailed(false); setAttempt((value) => value + 1); }, []);

  return {
    // Presence is only known while connected; offline, the last snapshot would be a guess.
    onlineUserIds: connected ? online : null,
    messages,
    arrival,
    status,
    syncFailed,
    connection: realtime?.status ?? 'unavailable',
    hasOlder: nextBefore !== null,
    loadingOlder,
    olderError,
    loadOlder,
    retry,
    resync,
    send,
  };
}
