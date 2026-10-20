import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { controlStyles } from '@/design-system/components/control-styles';
import { FeedbackMessage, WiseButton, WiseCard, WiseIcon, WiseText, theme } from '@/design-system';
import { SectionHeader } from '@/features/character/character-parts';
import { raidHitText, type ChatMessage, type GuildChat } from './guild-chat';
import { CARD_GAP, CARD_PADDING, FRAME_RADIUS, INSET_RADIUS, cardText } from './guild-card-style';
import { HeroAvatar } from './hero-avatar';

export type GuildTab = 'raid' | 'mural' | 'members' | 'history';

const TABS: { id: GuildTab; label: string }[] = [
  { id: 'raid', label: 'Raid' },
  { id: 'mural', label: 'Mural' },
  { id: 'members', label: 'Membros' },
  { id: 'history', label: 'Histórico' },
];

export function formatOnlineCount(count: number): string {
  return `${count} online`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "14:05" for today, "12/10 14:05" before that. */
export function formatMessageTime(sentAt: string, now: Date = new Date()): string {
  const date = new Date(sentAt);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.toDateString() === now.toDateString() ? time : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${time}`;
}

/** "N online" in the Guild header. Hidden until presence is known, so it never shows a guess. */
export function OnlineIndicator({ onlineUserIds }: { onlineUserIds: ReadonlySet<string> | null }) {
  if (!onlineUserIds) return null;
  const count = onlineUserIds.size;
  return (
    <View
      accessibilityLabel={`${count} ${count === 1 ? 'membro online' : 'membros online'} agora`}
      accessibilityLiveRegion="polite"
      accessible
      aria-live="polite"
      style={styles.onlinePill}
      testID="guild-online-count"
    >
      <PresenceDot online={count > 0} />
      <WiseText color={count > 0 ? 'textPrimary' : 'textSecondary'} variant="label">{formatOnlineCount(count)}</WiseText>
    </View>
  );
}

/** The phone sections of the Guild screen (Figma 06c); the desktop shows them all at once in two columns. */
export function GuildTabs({ selected, onSelect }: { selected: GuildTab; onSelect: (tab: GuildTab) => void }) {
  return (
    <View accessibilityLabel="Seções da guilda" role="tablist" style={styles.tabs} testID="guild-tabs">
      {TABS.map((tab) => <GuildTabButton active={tab.id === selected} key={tab.id} label={tab.label} onPress={() => onSelect(tab.id)} testID={`guild-tab-${tab.id}`} />)}
    </View>
  );
}

function GuildTabButton({ active, label, onPress, testID }: { active: boolean; label: string; onPress: () => void; testID: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive, focused && Platform.OS === 'web' && controlStyles.webFocus]}
      testID={testID}
    >
      <WiseText color={active ? 'accentHighlight' : 'textSecondary'} variant="label">{label}</WiseText>
    </Pressable>
  );
}

/** Online is a filled dot, offline an empty ring: the two differ in shape as well as color. */
export function PresenceDot({ online, testID }: { online: boolean; testID?: string }) {
  return <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} testID={testID} />;
}

/** An Aviso do Mural: a boxed line with a flame, no avatar and no author line. */
function NoticeItem({ message }: { message: ChatMessage }) {
  const time = formatMessageTime(message.sentAt);
  const text = raidHitText(message);
  return (
    <View accessibilityLabel={`Aviso, ${time}: ${text}`} accessible style={styles.notice} testID={`guild-mural-notice-${message.id}`}>
      <WiseIcon color="accentPrimary" name="flame" size="xsmall" />
      <Text style={styles.noticeText}>{text}</Text>
      <Text style={cardText.meta}>{time}</Text>
    </View>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.kind === 'raid_hit') return <NoticeItem message={message} />;
  const time = formatMessageTime(message.sentAt);
  return (
    <View accessibilityLabel={`${message.displayName}, ${time}: ${message.body}`} accessible style={styles.message} testID={`guild-mural-message-${message.id}`}>
      {/* The chat gateway does not send the member's look yet, so the portrait is the default hero. */}
      <HeroAvatar style={styles.portrait} />
      <View style={styles.messageMain}>
        <View style={styles.messageMeta}>
          <Text style={cardText.name}>{message.displayName}</Text>
          <Text style={cardText.meta}>{time}</Text>
        </View>
        <Text selectable style={cardText.body}>{message.body}</Text>
      </View>
    </View>
  );
}

/**
 * Reads out messages other members send while the Guild screen is open, whatever the tab. History, recovered
 * messages and the member's own sends stay quiet.
 */
export function MuralAnnouncer({ arrival }: { arrival: ChatMessage | null }) {
  // Keyed by message: a repeat of the same text is a new node, so screen readers read it again.
  return (
    <WiseText accessibilityLiveRegion="polite" aria-live="polite" key={arrival?.id} style={styles.announcement} testID="guild-mural-announcer" variant="body">
      {!arrival ? '' : arrival.kind === 'raid_hit'
        ? `Aviso no Mural, ${formatMessageTime(arrival.sentAt)}: ${raidHitText(arrival)}`
        : `Nova mensagem no Mural de ${arrival.displayName}, ${formatMessageTime(arrival.sentAt)}: ${arrival.body}`}
    </WiseText>
  );
}

/** The Figma 06c portrait and send button are 28 px; the gap between a portrait and its text, and the Aviso's side padding, are 10 px. */
const PORTRAIT_SIZE = 28;
const MESSAGE_GAP = 10;
/** How close to the top of the list a scroll has to get before the previous page loads. */
const NEAR_TOP_PX = 48;
/** Room for the app header above the Mural when the iOS keyboard pushes it up. */
const KEYBOARD_OFFSET_PX = 96;

/** Writes to the Mural. The chat policy lives on the server: an empty or long message is sent and its ack explains the refusal. */
function MuralComposer({ canWrite, send }: { canWrite: boolean; send: GuildChat['send'] }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setSendError(null);
    const result = await send(draft);
    setSending(false);
    if (result.ok) setDraft('');
    else setSendError(result.message);
  };

  return (
    <View style={styles.composer}>
      <View style={styles.composerField}>
        <TextInput
          accessibilityLabel="Mensagem para a guilda"
          editable={canWrite && !sending}
          multiline
          nativeID="guild-mural-input"
          onChangeText={(text) => { setDraft(text); if (sendError) setSendError(null); }}
          onSubmitEditing={() => void submit()}
          placeholder="Escreva para a guilda…"
          placeholderTextColor={theme.color.textTertiary}
          style={styles.input}
          submitBehavior="submit"
          value={draft}
        />
        <Pressable
          accessibilityLabel="Enviar"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canWrite || sending, busy: sending }}
          disabled={!canWrite || sending}
          onPress={() => void submit()}
          style={[styles.sendButton, (!canWrite || sending) && styles.sendButtonDisabled]}
          testID="guild-mural-send"
        >
          {sending
            ? <ActivityIndicator color={theme.color.textPrimary} size="small" />
            : <WiseIcon color={canWrite ? 'textPrimary' : 'textDisabled'} name="play" size="small" />}
        </Pressable>
      </View>
      {sendError ? <FeedbackMessage message={sendError} testID="guild-mural-send-error" title="Mensagem não enviada" variant="error" /> : null}
    </View>
  );
}

export function MuralPanel({ chat }: { chat: GuildChat }) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  // Where the reader was when an older page was asked for, so it lands on the same message once prepended.
  const prependAnchor = useRef<{ height: number; offset: number } | null>(null);
  const shownLastId = useRef<string | undefined>(undefined);
  // Paging up only starts after the list first settled at the bottom, never from the initial offset of 0.
  const settled = useRef(false);
  const lastId = chat.messages.at(-1)?.id;

  /** `retrying`: the reader asked again after a failed page; scrolling alone never retries it. */
  const loadOlder = (retrying = false) => {
    if (!chat.hasOlder || chat.loadingOlder || (chat.olderError && !retrying)) return;
    prependAnchor.current = { height: contentHeight.current, offset: offset.current };
    chat.loadOlder();
  };

  const onContentSizeChange = (_width: number, height: number) => {
    const anchor = prependAnchor.current;
    if (shownLastId.current !== lastId) {
      // A new message at the bottom keeps the reader at the bottom.
      shownLastId.current = lastId;
      scroll.current?.scrollToEnd({ animated: false });
      settled.current = true;
    } else if (anchor && height > anchor.height) {
      scroll.current?.scrollTo({ y: anchor.offset + height - anchor.height, animated: false });
      prependAnchor.current = null;
    }
    contentHeight.current = height;
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    if (settled.current && offset.current < NEAR_TOP_PX) loadOlder();
  };

  const disconnected = chat.connection !== 'connected';
  const body = (() => {
    if (chat.connection === 'unavailable' || (chat.status === 'loading' && disconnected)) {
      return <FeedbackMessage message="O Mural volta assim que a conexão em tempo real for restabelecida." testID="guild-mural-offline" title="Mural desconectado" variant="warning" />;
    }
    if (chat.status === 'loading') return <WiseText color="textSecondary" testID="guild-mural-loading" variant="body">Abrindo o Mural…</WiseText>;
    if (chat.status === 'error') {
      return <View style={styles.stack} testID="guild-mural-error">
        <FeedbackMessage message="Não foi possível abrir o Mural da guilda." title="Mural indisponível" variant="error" />
        <WiseButton label="Tentar novamente" onPress={chat.retry} variant="secondary" />
      </View>;
    }
    return (
      <>
        {disconnected ? <FeedbackMessage message="Reconectando. As mensagens perdidas aparecem quando a conexão voltar." testID="guild-mural-reconnecting" title="Mural desconectado" variant="warning" /> : null}
        {chat.syncFailed && !disconnected ? (
          <View style={styles.stack} testID="guild-mural-sync-error">
            <FeedbackMessage message="Não foi possível buscar as mensagens enviadas enquanto você estava sem conexão." title="Mural incompleto" variant="error" />
            <WiseButton label="Buscar mensagens perdidas" onPress={chat.resync} testID="guild-mural-resync" variant="secondary" />
          </View>
        ) : null}
        <ScrollView
          accessibilityLabel="Mensagens do Mural"
          contentContainerStyle={styles.messages}
          onContentSizeChange={onContentSizeChange}
          onScroll={onScroll}
          ref={scroll}
          scrollEventThrottle={100}
          style={styles.scroll}
          testID="guild-mural-messages"
        >
          {chat.hasOlder ? (
            <WiseButton label="Carregar mensagens anteriores" loading={chat.loadingOlder} onPress={() => loadOlder()} testID="guild-mural-older" variant="ghost" />
          ) : chat.messages.length ? (
            <WiseText color="textTertiary" style={styles.start} variant="body">Início do Mural</WiseText>
          ) : null}
          {chat.olderError ? (
            <View style={styles.stack}>
              <FeedbackMessage message="Não foi possível carregar mensagens anteriores." title="Histórico incompleto" variant="error" />
              <WiseButton label="Tentar novamente" onPress={() => loadOlder(true)} testID="guild-mural-older-retry" variant="ghost" />
            </View>
          ) : null}
          {chat.messages.length
            ? chat.messages.map((message) => <MessageItem key={message.id} message={message} />)
            : <WiseText color="textSecondary" testID="guild-mural-empty" variant="body">O Mural está em silêncio. Escreva a primeira mensagem para a guilda.</WiseText>}
        </ScrollView>
      </>
    );
  })();

  const canWrite = chat.status === 'ready' && !disconnected;
  return (
    <WiseCard accessibilityLabel="Mural da guilda" role="region" testID="guild-mural">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={KEYBOARD_OFFSET_PX}
        style={styles.cardContent}
      >
        <SectionHeader aside={chat.onlineUserIds ? <Text style={styles.onlineCount} testID="guild-mural-online">{formatOnlineCount(chat.onlineUserIds.size)}</Text> : null}>Mural</SectionHeader>
        {body}
        <MuralComposer canWrite={canWrite} send={chat.send} />
      </KeyboardAvoidingView>
    </WiseCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  // Figma 06c: 20 px of padding and 14 px between the card's blocks, values the spacing scale has no step for.
  cardContent: { padding: CARD_PADDING, gap: CARD_GAP },
  onlinePill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: theme.space.inlineTight,
    paddingVertical: theme.space.inlineHairline, paddingHorizontal: theme.space.stackTight,
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset,
  },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: theme.border.standard },
  dotOnline: { backgroundColor: theme.color.feedbackSuccess, borderColor: theme.color.feedbackSuccess },
  dotOffline: { backgroundColor: 'transparent', borderColor: theme.color.textDisabled },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  tab: { paddingVertical: theme.space.inlineTight, paddingHorizontal: theme.space.controlInset, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  // Selected is marked by the underline and the brighter label, never by color alone.
  tabActive: { borderBottomColor: theme.color.accentPrimary },
  scroll: { maxHeight: 420, minHeight: 160 },
  messages: { gap: CARD_GAP },
  start: { textAlign: 'center' },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: MESSAGE_GAP },
  portrait: { width: PORTRAIT_SIZE, height: PORTRAIT_SIZE },
  messageMain: { flex: 1, minWidth: 0, gap: 3 },
  messageMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight,
    paddingVertical: theme.space.inlineTight, paddingHorizontal: MESSAGE_GAP,
    borderRadius: INSET_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset,
  },
  noticeText: { flex: 1, fontFamily: cardText.body.fontFamily, fontSize: cardText.body.fontSize, lineHeight: cardText.body.lineHeight, color: theme.color.accentPrimary },
  onlineCount: { ...cardText.meta, letterSpacing: 0.8 },
  composer: { gap: theme.space.inlineTight, alignItems: 'stretch' },
  composerField: {
    flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight,
    paddingVertical: 6, paddingLeft: theme.space.stackTight, paddingRight: 6,
    borderRadius: INSET_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset,
  },
  input: { flex: 1, minWidth: 0, maxHeight: 96, paddingVertical: theme.space.inlineHairline, fontFamily: cardText.body.fontFamily, fontSize: cardText.body.fontSize, lineHeight: cardText.body.lineHeight, color: theme.color.textPrimary },
  sendButton: { width: PORTRAIT_SIZE, height: PORTRAIT_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: FRAME_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceElevated },
  sendButtonDisabled: { opacity: 0.5 },
  announcement: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
