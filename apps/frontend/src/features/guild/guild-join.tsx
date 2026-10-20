import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseCard, WiseField, WiseIcon, WiseText, theme, type WiseIconName } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import { CoinMark } from '@/features/market/coin';
import { SectionHeader } from '@/features/character/character-parts';
import { createGuild, joinGuild, type GuildSummary } from './api';
import { GuildEmblem, GuildSigil } from './guild-emblem';
import { CARD_GAP, FRAME_RADIUS, cardText } from './guild-card-style';
import { createGuildErrorMessage, formatMemberCount, joinGuildErrorMessage } from './messages';
import { guildDirectoryQueryOptions } from './queries';
import { GUILD_NAME_MAX_LENGTH, normalizeGuildName, validateGuildName } from './validation';

type GuildActionCallbacks = { onConflict: (error: unknown) => void };

/** The phone sections of the screen without a Guild (Figma 06d): Procurar and Fundar. */
export type JoinTab = 'search' | 'create';

const JOIN_TABS: { id: JoinTab; label: string }[] = [
  { id: 'search', label: 'Procurar' },
  { id: 'create', label: 'Fundar' },
];

function JoinTabs({ selected, onSelect }: { selected: JoinTab; onSelect: (tab: JoinTab) => void }) {
  const [focused, setFocused] = useState<JoinTab | null>(null);
  return (
    <View accessibilityLabel="Seções da tela sem guilda" role="tablist" style={styles.tabs} testID="guild-join-tabs">
      {JOIN_TABS.map((tab) => {
        const active = tab.id === selected;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            hitSlop={{ top: 6, bottom: 6 }}
            key={tab.id}
            onBlur={() => setFocused(null)}
            onFocus={() => setFocused(tab.id)}
            onPress={() => onSelect(tab.id)}
            style={[styles.tab, active && styles.tabActive, focused === tab.id && Platform.OS === 'web' && controlStyles.webFocus]}
            testID={`guild-join-tab-${tab.id}`}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function JoinHeader({ desktop }: { desktop: boolean }) {
  return (
    <View style={styles.header} testID="guild-join-header">
      <Text aria-hidden style={styles.eyebrow}>GUILDA</Text>
      <Text accessibilityRole="header" aria-level={1} style={[styles.heading, desktop && styles.headingDesktop]}>Escolha sua ordem</Text>
      <Text style={[cardText.body, styles.lead]}>Você ainda não tem uma guilda. Entre em uma aberta ou funde a sua e chame os amigos.</Text>
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
          helpText="3 a 60 caracteres"
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

function DirectoryCard({ desktop, onJoined, onConflict }: { desktop: boolean; onJoined: () => void } & GuildActionCallbacks) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const directory = useInfiniteQuery(guildDirectoryQueryOptions(search));
  const join = useMutation({ mutationFn: joinGuild, onSuccess: onJoined, onError: onConflict });
  const guilds = directory.data?.pages.flatMap((page) => page.items) ?? [];

  const runSearch = () => setSearch(draft.trim());

  const body = (() => {
    if (directory.isPending) return <WiseText color="textSecondary" testID="guild-directory-loading" variant="body">Procurando guildas…</WiseText>;
    if (directory.isError && !directory.data) {
      return <View style={styles.stack} testID="guild-directory-error">
        <FeedbackMessage message="Não foi possível carregar as guildas." title="Guildas indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={directory.isRefetching} onPress={() => void directory.refetch()} variant="secondary" />
      </View>;
    }
    if (!guilds.length) {
      return <WiseText color="textSecondary" testID="guild-directory-empty" variant="body">
        {search ? 'Nenhuma guilda encontrada para essa busca.' : 'Ainda não há guildas. Funde a primeira!'}
      </WiseText>;
    }
    return <>
      <View>
        {guilds.map((guild, index) => (
          <DirectoryItem
            busy={join.isPending && join.variables === guild.id}
            first={index === 0}
            guild={guild}
            key={guild.id}
            onJoin={() => { if (!join.isPending) { join.reset(); join.mutate(guild.id); } }}
          />
        ))}
      </View>
      {directory.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais guildas." title="Lista incompleta" variant="error" /> : null}
      {directory.hasNextPage
        ? <Pressable accessibilityRole="button" disabled={directory.isFetchingNextPage} onPress={() => void directory.fetchNextPage()} style={styles.more} testID="guild-directory-more">
          <Text style={styles.moreLabel}>{directory.isFetchingNextPage ? 'Carregando…' : desktop ? 'Carregar mais guildas' : 'Carregar mais'}</Text>
        </Pressable>
        : null}
    </>;
  })();

  return (
    <View accessibilityLabel="Encontrar guilda" role="region" style={styles.directoryBlock} testID="guild-directory">
      <SectionHeader aside={desktop ? <Text style={cardText.meta}>Entrada aberta</Text> : undefined}>Encontre uma guilda</SectionHeader>
      <WiseCard style={[styles.directoryCard, !desktop && styles.directoryCardPhone]}>
        <View style={desktop ? styles.searchRow : undefined}>
          <View style={desktop ? styles.searchField : undefined}>
            <WiseField
              autoCapitalize="none"
              label="Buscar por nome"
              maxLength={GUILD_NAME_MAX_LENGTH}
              nativeID="guild-directory-search"
              onChangeText={setDraft}
              onSubmitEditing={runSearch}
              placeholder="Nome da guilda"
              returnKeyType="search"
              value={draft}
            />
          </View>
          {desktop ? <WiseButton label="Buscar" onPress={runSearch} testID="guild-directory-search-submit" variant="secondary" /> : null}
        </View>
        {join.isError ? <FeedbackMessage message={joinGuildErrorMessage(join.error)} testID="guild-join-error" title="Não foi possível entrar" variant="error" /> : null}
        {body}
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
        <View style={styles.columnMain}>{directory}</View>
        <View style={styles.columnSide}>{create}{how}</View>
      </View>
    </View>;
  }
  return <View style={styles.page} testID="guild-join-tabs-layout">
    <JoinHeader desktop={false} />
    <JoinTabs onSelect={setTab} selected={tab} />
    <View style={tab === 'search' ? undefined : styles.hidden}>{directory}</View>
    <View style={[styles.stack, tab === 'create' ? undefined : styles.hidden]}>{create}{how}</View>
  </View>;
}

const { fontFamily: mono } = theme.type.mono;
const { fontFamily: sans } = theme.type.label;
const { fontFamily: serif } = theme.type.title;

const styles = StyleSheet.create({
  page: { gap: theme.space.cardInset },
  stack: { gap: theme.space.stackDefault },
  hidden: { display: 'none' },
  header: { gap: 6 },
  eyebrow: { fontFamily: mono, fontSize: 10, letterSpacing: 2, color: theme.color.accentPrimary },
  heading: { fontFamily: serif, fontSize: 22, color: theme.color.textPrimary },
  headingDesktop: { fontSize: 28 },
  intro: { fontFamily: theme.type.body.fontFamily, fontSize: 13, lineHeight: 19, color: theme.color.textSecondary },
  lead: { fontSize: 13, lineHeight: 19, maxWidth: 560 },

  // Figma 06d desktop: a 680 px column of guilds and a 392 px side column, 24 px apart.
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.cardInset },
  columnMain: { flex: 680 },
  columnSide: { flex: 392, gap: theme.space.stackDefault },

  tabs: { flexDirection: 'row', gap: 3, padding: theme.space.inlineHairline, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  tab: { flex: 1, alignItems: 'center', paddingVertical: theme.space.inlineTight, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: 'transparent' },
  tabActive: { backgroundColor: theme.color.surfaceCard, borderColor: theme.color.accentMuted },
  tabLabel: { fontFamily: sans, fontSize: 12, lineHeight: 16, color: theme.color.textTertiary },
  tabLabelActive: { color: theme.color.accentHighlight },

  directoryBlock: { gap: theme.space.stackTight },
  directoryCard: { padding: theme.space.stackDefault, gap: CARD_GAP, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
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
  createContentPhone: { padding: 18 },
  createHeader: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  createTitles: { flex: 1, gap: theme.space.inlineHairline },
  createEyebrow: { fontFamily: serif, fontSize: 11, letterSpacing: 2.6, color: theme.color.accentPrimary, textTransform: 'uppercase' },
  createTitle: { fontFamily: serif, fontSize: 18, color: theme.color.textPrimary },

  howCard: { padding: theme.space.stackDefault, gap: CARD_GAP, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.stackTight },
  howIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: FRAME_RADIUS, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  howText: { flex: 1, minWidth: 0, gap: 2 },
});
