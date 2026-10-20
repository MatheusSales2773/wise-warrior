import { useInfiniteQuery, useMutation, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseCard, WiseField, WiseIcon, theme, type WiseIconName } from '@/design-system';
import { CoinMark } from '@/features/market/coin';
import { SectionHeader } from '@/features/character/character-parts';
import { createGuild, joinGuild, type GuildPage, type GuildSummary } from './api';
import { GuildEmblem, GuildSigil } from './guild-emblem';
import { CARD_GAP, CARD_PADDING, FRAME_RADIUS, cardText, columnStyles } from './guild-card-style';
import { createGuildErrorMessage, formatMemberCount, joinGuildErrorMessage } from './messages';
import { TabList } from './guild-tabs';
import { guildDirectoryQueryOptions } from './queries';
import { GUILD_NAME_MAX_LENGTH, GUILD_NAME_RULE, normalizeGuildName, validateGuildName } from './validation';

type GuildActionCallbacks = { onConflict: (error: unknown) => void };

/** The phone sections of the screen without a Guild (Figma 06d): Procurar and Fundar. */
export type JoinTab = 'search' | 'create';

const JOIN_TABS: { id: JoinTab; label: string }[] = [
  { id: 'search', label: 'Procurar' },
  { id: 'create', label: 'Fundar' },
];

function JoinHeader({ desktop }: { desktop: boolean }) {
  return (
    <View style={styles.header} testID="guild-join-header">
      <Text aria-hidden style={styles.eyebrow}>GUILDA</Text>
      <Text accessibilityRole="header" aria-level={1} style={[styles.heading, desktop && styles.headingDesktop]}>Escolha sua ordem</Text>
      <Text style={[styles.intro, styles.leadWidth]}>Você ainda não tem uma guilda. Entre em uma aberta ou funde a sua e chame os amigos.</Text>
    </View>
  );
}

function CreateGuildCard({ desktop, onCreated, onConflict }: { desktop: boolean; onCreated: () => void } & GuildActionCallbacks) {
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const create = useMutation({ mutationFn: createGuild, onSuccess: onCreated, onError: onConflict });

  const submit = () => {
    if (create.isPending) return;
    const error = validateGuildName(name);
    setFieldError(error);
    if (error) return;
    create.reset();
    create.mutate(normalizeGuildName(name));
  };

  return (
    <WiseCard accessibilityLabel="Fundar guilda" role="region" style={styles.createCard} testID="guild-create">
      <View aria-busy={create.isPending} style={[styles.createContent, !desktop && styles.createContentPhone]}>
        <View style={styles.createHeader}>
          <GuildSigil size={48} />
          <View style={styles.createTitles}>
            <Text style={styles.createEyebrow}>Funde sua guilda</Text>
            <Text accessibilityRole="header" aria-level={2} style={styles.createTitle}>Comece sua ordem</Text>
          </View>
        </View>
        <Text style={styles.intro}>Você será o líder. A entrada é aberta: qualquer aventureiro sem guilda pode encontrá-la e entrar.</Text>
        <WiseField
          autoCapitalize="words"
          editable={!create.isPending}
          error={fieldError}
          helpText={GUILD_NAME_RULE}
          hint={`${name.length} / ${GUILD_NAME_MAX_LENGTH}`}
          label="Nome da guilda"
          maxLength={GUILD_NAME_MAX_LENGTH}
          nativeID="guild-create-name"
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder="Ex.: Ordem dos Madrugadores"
          returnKeyType="done"
          value={name}
        />
        {create.isError ? <FeedbackMessage message={createGuildErrorMessage(create.error)} testID="guild-create-error" title="Guilda não criada" variant="error" /> : null}
        <WiseButton
          label="Fundar guilda"
          loading={create.isPending}
          onPress={submit}
          testID="guild-create-submit"
          trailing={<WiseIcon color="backgroundCanvas" name="chevron-forward" size="xsmall" />}
        />
      </View>
    </WiseCard>
  );
}

function DirectoryItem({ busy, first, guild, onJoin }: { busy: boolean; first: boolean; guild: GuildSummary; onJoin: () => void }) {
  return (
    <View style={[styles.directoryItem, !first && styles.directoryItemDivided]} testID={`guild-directory-item-${guild.id}`}>
      <GuildEmblem decorative guildId={guild.id} name={guild.name} size={40} />
      <View style={styles.directoryMain}>
        <Text style={styles.directoryName}>{guild.name}</Text>
        <Text style={styles.directoryMeta}>Nível {guild.level} · {formatMemberCount(guild.memberCount)}</Text>
      </View>
      <WiseButton accessibilityLabel={`Entrar na guilda ${guild.name}`} label="Entrar" loading={busy} onPress={onJoin} testID={`guild-join-${guild.id}`} variant="secondary" />
    </View>
  );
}

/** Pause after the last keystroke before the search runs by itself. */
const SEARCH_DEBOUNCE_MS = 300;

/** The name field; it searches while the user types, right away on the keyboard's own submit, and the desktop (Figma 06d) adds a "Buscar" button. */
function DirectorySearch({ desktop, onSearch }: { desktop: boolean; onSearch: (name: string) => void }) {
  const [draft, setDraft] = useState('');
  const run = () => onSearch(draft.trim());
  useEffect(() => {
    const timer = setTimeout(() => onSearch(draft.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onSearch]);
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchField}>
        <WiseField
          autoCapitalize="none"
          label="Buscar por nome"
          maxLength={GUILD_NAME_MAX_LENGTH}
          nativeID="guild-directory-search"
          onChangeText={setDraft}
          onSubmitEditing={run}
          placeholder="Nome da guilda"
          returnKeyType="search"
          value={draft}
        />
      </View>
      {desktop ? <WiseButton label="Buscar" onPress={run} testID="guild-directory-search-submit" variant="secondary" /> : null}
    </View>
  );
}

type DirectoryQuery = UseInfiniteQueryResult<InfiniteData<GuildPage>, Error>;

/** What the directory shows below the search: loading, error, empty or the list with its "Carregar mais". */
function DirectoryList({ directory, joiningId, loadMoreLabel, onJoin, search }: {
  directory: DirectoryQuery; joiningId: string | null; loadMoreLabel: string; onJoin: (guildId: string) => void; search: string;
}) {
  const guilds = directory.data?.pages.flatMap((page) => page.items) ?? [];

  if (directory.isPending) return <Text style={cardText.body} testID="guild-directory-loading">Procurando guildas…</Text>;
  if (directory.isError && !directory.data) {
    return <View style={styles.stack} testID="guild-directory-error">
      <FeedbackMessage message="Não foi possível carregar as guildas." title="Guildas indisponíveis" variant="error" />
      <WiseButton label="Tentar novamente" loading={directory.isRefetching} onPress={() => void directory.refetch()} variant="secondary" />
    </View>;
  }
  if (!guilds.length) {
    return <Text style={cardText.body} testID="guild-directory-empty">
      {search ? 'Nenhuma guilda encontrada para essa busca.' : 'Ainda não há guildas. Funde a primeira!'}
    </Text>;
  }
  return <>
    <View>
      {guilds.map((guild, index) => (
        <DirectoryItem busy={joiningId === guild.id} first={index === 0} guild={guild} key={guild.id} onJoin={() => onJoin(guild.id)} />
      ))}
    </View>
    {directory.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais guildas." title="Lista incompleta" variant="error" /> : null}
    {directory.hasNextPage
      ? <Pressable accessibilityRole="button" disabled={directory.isFetchingNextPage} onPress={() => void directory.fetchNextPage()} style={styles.more} testID="guild-directory-more">
        <Text style={styles.moreLabel}>{directory.isFetchingNextPage ? 'Carregando…' : loadMoreLabel}</Text>
      </Pressable>
      : null}
  </>;
}

function DirectoryCard({ desktop, onJoined, onConflict }: { desktop: boolean; onJoined: () => void } & GuildActionCallbacks) {
  const [search, setSearch] = useState('');
  const directory = useInfiniteQuery(guildDirectoryQueryOptions(search));
  const join = useMutation({ mutationFn: joinGuild, onSuccess: onJoined, onError: onConflict });
  const joinGuildById = (guildId: string) => {
    if (join.isPending) return;
    join.reset();
    join.mutate(guildId);
  };

  return (
    <View accessibilityLabel="Encontrar guilda" role="region" style={styles.directoryBlock} testID="guild-directory">
      <SectionHeader aside={desktop ? <Text style={cardText.meta}>Entrada aberta</Text> : undefined}>Encontre uma guilda</SectionHeader>
      <WiseCard style={[styles.directoryCard, !desktop && styles.directoryCardPhone]}>
        <DirectorySearch desktop={desktop} onSearch={setSearch} />
        {join.isError ? <FeedbackMessage message={joinGuildErrorMessage(join.error)} testID="guild-join-error" title="Não foi possível entrar" variant="error" /> : null}
        <DirectoryList
          directory={directory}
          joiningId={join.isPending ? join.variables : null}
          loadMoreLabel={desktop ? 'Carregar mais guildas' : 'Carregar mais'}
          onJoin={joinGuildById}
          search={search}
        />
      </WiseCard>
    </View>
  );
}

const HOW_IT_WORKS: { title: string; text: string; icon: WiseIconName | 'coin' }[] = [
  { title: 'Raid semanal', text: 'A guilda inteira foca junta para derrotar o chefe até domingo.', icon: 'flame' },
  { title: 'Mural', text: 'Converse com a guilda e acompanhe cada golpe em tempo real.', icon: 'chatbubble-ellipses-outline' },
  { title: 'Recompensas', text: 'Quem contribui leva os itens da Missão e moedas.', icon: 'coin' },
];

function HowItWorksCard() {
  return (
    <WiseCard accessibilityLabel="Como funciona" role="region" style={styles.howCard} testID="guild-how-it-works">
      <SectionHeader>Como funciona</SectionHeader>
      {HOW_IT_WORKS.map((item) => (
        <View key={item.title} style={styles.howRow}>
          <View style={styles.howIcon}>
            {item.icon === 'coin' ? <CoinMark scale={2} /> : <WiseIcon color="textPrimary" name={item.icon} size="small" />}
          </View>
          <View style={styles.howText}>
            <Text style={cardText.name}>{item.title}</Text>
            <Text style={cardText.body}>{item.text}</Text>
          </View>
        </View>
      ))}
      <Text style={cardText.meta}>Cada aventureiro participa de uma guilda por vez.</Text>
    </WiseCard>
  );
}

/** The screen of a user without a Guild (Figma 06d): both columns on the desktop, Procurar | Fundar tabs on the phone. */
export function JoinGuild({ desktop, onChanged, onConflict }: { desktop: boolean; onChanged: () => void } & GuildActionCallbacks) {
  // The tab is screen state, not a route. Both panels stay mounted, so a typed name or search survives a tab change.
  const [tab, setTab] = useState<JoinTab>('search');
  const directory = <DirectoryCard desktop={desktop} onConflict={onConflict} onJoined={onChanged} />;
  const create = <CreateGuildCard desktop={desktop} onConflict={onConflict} onCreated={onChanged} />;
  const how = <HowItWorksCard />;

  if (desktop) {
    return <View style={styles.page} testID="guild-join-desktop">
      <JoinHeader desktop />
      <View style={styles.columns}>
        <View style={columnStyles.main}>{directory}</View>
        <View style={[columnStyles.side, styles.stack]}>{create}{how}</View>
      </View>
    </View>;
  }
  return <View style={styles.page} testID="guild-join-tabs-layout">
    <JoinHeader desktop={false} />
    <TabList accessibilityLabel="Seções da tela sem guilda" onSelect={setTab} selected={tab} tabs={JOIN_TABS} tabTestIDPrefix="guild-join-tab-" testID="guild-join-tabs" variant="segmented" />
    <View role="tabpanel" style={tab === 'search' ? undefined : styles.hidden} testID="guild-join-panel-search">{directory}</View>
    <View role="tabpanel" style={[styles.stack, tab === 'create' ? undefined : styles.hidden]} testID="guild-join-panel-create">{create}{how}</View>
  </View>;
}

const { fontFamily: mono } = theme.type.mono;
const { fontFamily: sans } = theme.type.label;
const { fontFamily: serif } = theme.type.title;

/** Figma 06d: values the spacing scale has no step for. */
const CREATE_PADDING_PHONE = 18;
const HEADER_GAP = 6;
const LEAD_MAX_WIDTH = 560;
const HOW_ICON_BOX = 32;
const HOW_TEXT_GAP = 2;

const styles = StyleSheet.create({
  page: { gap: theme.space.cardInset },
  stack: { gap: theme.space.stackDefault },
  hidden: { display: 'none' },
  header: { gap: HEADER_GAP },
  eyebrow: { fontFamily: mono, fontSize: 10, letterSpacing: 2, color: theme.color.accentPrimary },
  heading: { fontFamily: serif, fontSize: 22, color: theme.color.textPrimary },
  headingDesktop: { fontSize: 28 },
  intro: { fontFamily: theme.type.body.fontFamily, fontSize: 13, lineHeight: 19, color: theme.color.textSecondary },
  leadWidth: { maxWidth: LEAD_MAX_WIDTH },

  // Figma 06d desktop: the 680 px and 392 px columns of `columnStyles`, 24 px apart.
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.cardInset },

  directoryBlock: { gap: theme.space.stackTight },
  directoryCard: { padding: CARD_PADDING, gap: CARD_GAP, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
  directoryCardPhone: { padding: theme.space.controlInset },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.stackTight },
  searchField: { flex: 1 },
  directoryItem: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP, paddingVertical: theme.space.stackTight },
  directoryItemDivided: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderGhost },
  directoryMain: { flex: 1, minWidth: 0, gap: theme.space.inlineHairline },
  directoryName: { fontFamily: sans, fontSize: 14, lineHeight: 18, color: theme.color.textPrimary },
  directoryMeta: { fontFamily: mono, fontSize: 10, letterSpacing: 0.8, color: theme.color.textTertiary, textTransform: 'uppercase' },
  more: { alignSelf: 'flex-start', minHeight: theme.layout.touchTarget, justifyContent: 'center' },
  moreLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: theme.color.accentPrimary },

  createCard: { borderWidth: theme.border.standard, borderColor: theme.color.accentMuted },
  createContent: { padding: theme.space.cardInset, gap: theme.space.controlInset },
  createContentPhone: { padding: CREATE_PADDING_PHONE },
  createHeader: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  createTitles: { flex: 1, gap: theme.space.inlineHairline },
  createEyebrow: { fontFamily: serif, fontSize: 11, letterSpacing: 2.6, color: theme.color.accentPrimary, textTransform: 'uppercase' },
  createTitle: { fontFamily: serif, fontSize: 18, color: theme.color.textPrimary },

  howCard: { padding: CARD_PADDING, gap: CARD_GAP, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.stackTight },
  howIcon: { width: HOW_ICON_BOX, height: HOW_ICON_BOX, alignItems: 'center', justifyContent: 'center', borderRadius: FRAME_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  howText: { flex: 1, minWidth: 0, gap: HOW_TEXT_GAP },
});
