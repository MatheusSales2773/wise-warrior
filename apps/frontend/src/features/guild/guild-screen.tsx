import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseField, WiseText, isDesktopLayout, theme } from '@/design-system';
import { isApiError } from '@/core/api/api-error';
import { createGuild, joinGuild, leaveGuild, type GuildMember, type GuildSummary, type MyGuild, type PastRaid } from './api';
import {
  createGuildErrorMessage, formatPastRaidMine, formatPastRaidOutcome, formatRaidWeek, formatGuildRole, formatGuildRoleSeal, formatGuildStats, formatMemberCount,
  joinGuildErrorMessage, leaveGuildErrorMessage,
} from './messages';
import { activeRaidQueryOptions, guildDirectoryQueryOptions, guildKeys, guildMembersQueryOptions, myGuildQueryOptions, pastRaidsQueryOptions } from './queries';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { useGuildChat } from './guild-chat';
import { SectionHeader } from '@/features/character/character-parts';
import { GuildTabs, MuralAnnouncer, MuralPanel, OnlineIndicator, PresenceDot, formatOnlineCount, type GuildTab } from './guild-mural';
import { HeroAvatar } from './hero-avatar';
import { GuildEmblem } from './guild-emblem';
import { RankingCard } from './guild-ranking';
import { RaidCard } from './guild-raid-card';
import { GUILD_NAME_MAX_LENGTH, normalizeGuildName, validateGuildName } from './validation';

function MemberItem({ member, online }: { member: GuildMember; online: boolean | null }) {
  const presence = online === null ? '' : online ? ', online' : ', offline';
  const detail = online === null ? `Nv ${member.level}` : `Nv ${member.level} · ${online ? 'Online' : 'Offline'}`;
  return (
    <View accessible accessibilityLabel={`${member.displayName}${presence}, ${formatGuildRole(member.role)}. Nível ${member.level}`} style={styles.memberRow} testID={`guild-member-${member.userId}`}>
      <View style={styles.memberAvatar} testID={`guild-member-portrait-${member.userId}`}>
        {/* The API does not return the equipped Avatar yet (#214): every member gets the default portrait. */}
        <HeroAvatar entry={{ avatar: null }} style={styles.memberPortrait} />
        {online === null ? null : <View style={styles.memberPresence}><PresenceDot online={online} testID={`guild-member-${online ? 'online' : 'offline'}-${member.userId}`} /></View>}
      </View>
      <View style={styles.memberText}>
        <Text numberOfLines={1} style={[styles.memberName, online === false && styles.memberNameOffline]}>{member.displayName}</Text>
        <Text numberOfLines={1} style={styles.memberDetail}>{detail}</Text>
      </View>
      {member.role === 'leader'
        ? <View style={[styles.rolePill, styles.rolePillLeader]} testID={`guild-member-seal-${member.userId}`}><Text style={styles.memberSeal}>LÍDER</Text></View>
        : null}
    </View>
  );
}

function MembersCard({ guildId, memberCount, onlineUserIds }: { guildId: string; memberCount: number; onlineUserIds: ReadonlySet<string> | null }) {
  const members = useInfiniteQuery(guildMembersQueryOptions(guildId));
  const items = members.data?.pages.flatMap((page) => page.items) ?? [];

  const body = (() => {
    if (members.isPending) return <WiseText color="textSecondary" testID="guild-members-loading" variant="body">Carregando membros…</WiseText>;
    if (members.isError && !members.data) {
      return <View style={styles.stack} testID="guild-members-error">
        <FeedbackMessage message="Não foi possível carregar os membros." title="Membros indisponíveis" variant="error" />
        <WiseButton label="Tentar novamente" loading={members.isRefetching} onPress={() => void members.refetch()} variant="secondary" />
      </View>;
    }
    if (!items.length) return <WiseText color="textSecondary" testID="guild-members-empty" variant="body">Nenhum membro para mostrar ainda.</WiseText>;
    return <>
      {members.isError && !members.isFetchNextPageError ? <FeedbackMessage message="Não foi possível atualizar os membros." testID="guild-members-stale" title="Dados desatualizados" variant="error" /> : null}
      {items.map((member) => <MemberItem key={member.userId} member={member} online={onlineUserIds ? onlineUserIds.has(member.userId) : null} />)}
      {members.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais membros." title="Lista incompleta" variant="error" /> : null}
      {members.hasNextPage
        ? <WiseButton label="Carregar mais membros" loading={members.isFetchingNextPage} onPress={() => void members.fetchNextPage()} testID="guild-members-more" variant="ghost" />
        : null}
    </>;
  })();

  // The count is hidden with the Presença: without a connection there is nothing to say about who is online.
  const count = onlineUserIds ? `${memberCount} · ${formatOnlineCount(onlineUserIds.size)}` : String(memberCount);
  return (
    <View accessibilityLabel="Membros da guilda" role="region" style={styles.membersBlock} testID="guild-members">
      <SectionHeader aside={<Text style={styles.membersCount} testID="guild-members-count">{count}</Text>}>Membros</SectionHeader>
      <WiseCard style={styles.membersCard}>{body}</WiseCard>
    </View>
  );
}

function LeaveGuildAction({ guildId, isLeader, onLeft, onConflict }: { guildId: string; isLeader: boolean; onLeft: () => void; onConflict: (error: unknown) => void }) {
  const [confirming, setConfirming] = useState(false);
  const leave = useMutation({ mutationFn: () => leaveGuild(guildId), onSuccess: onLeft, onError: onConflict });

  if (!confirming) {
    return <WiseButton label="Sair da guilda" onPress={() => { leave.reset(); setConfirming(true); }} testID="guild-leave" variant="danger" />;
  }
  return (
    <View accessibilityLiveRegion="polite" style={styles.stack} testID="guild-leave-confirm">
      <WiseText variant="body">
        {isLeader ? 'Ao sair, a liderança passa ao membro mais antigo. Se você for o último, a guilda será encerrada.' : 'Tem certeza de que quer sair da guilda?'}
      </WiseText>
      {leave.isError ? <FeedbackMessage message={leaveGuildErrorMessage(leave.error)} testID="guild-leave-error" title="Não foi possível sair" variant="error" /> : null}
      <WiseButton label="Confirmar saída" loading={leave.isPending} onPress={() => { if (!leave.isPending) leave.mutate(); }} testID="guild-leave-confirm-button" variant="danger" />
      <WiseButton label="Cancelar" onPress={() => setConfirming(false)} testID="guild-leave-cancel" variant="ghost" />
    </View>
  );
}

function GuildCard({ mine, onlineUserIds, desktop }: { mine: MyGuild; onlineUserIds: ReadonlySet<string> | null; desktop: boolean }) {
  const { guild, role } = mine;
  return (
    <View accessibilityLabel="Sua guilda" accessibilityRole="summary" role="region" style={styles.identity} testID="guild-mine">
      <GuildEmblem decorative guildId={guild.id} name={guild.name} size={desktop ? 56 : 42} />
      <View style={styles.identityText}>
        <View style={styles.nameRow}>
          <WiseText accessibilityRole="header" aria-level={2} testID="guild-mine-name" variant={desktop ? 'title' : 'subtitle'}>{guild.name}</WiseText>
          <View style={[styles.rolePill, role === 'leader' && styles.rolePillLeader]} testID="guild-mine-role">
            <WiseText color={role === 'leader' ? 'accentPrimary' : 'textSecondary'} variant="caption">{formatGuildRoleSeal(role)}</WiseText>
          </View>
        </View>
        <View style={styles.statsRow}>
          <WiseText color="textTertiary" testID="guild-mine-stats" variant="caption">{formatGuildStats(guild.level, guild.memberCount)}</WiseText>
          <OnlineIndicator onlineUserIds={onlineUserIds} />
        </View>
      </View>
    </View>
  );
}

function PastRaidItem({ raid }: { raid: PastRaid }) {
  const week = formatRaidWeek(raid.startsAt, raid.endsAt);
  const outcome = formatPastRaidOutcome(raid.status);
  const mine = formatPastRaidMine(raid.me);
  return (
    <View
      accessible
      accessibilityLabel={`${raid.mission.name}. ${week}. ${outcome}. ${raid.progressXp} de ${raid.goalXp} XP. ${mine}.`}
      style={styles.pastRaidItem}
      testID={`guild-past-raid-${raid.id}`}
    >
      <WiseText variant="label">{raid.mission.name}</WiseText>
      <WiseText color="textSecondary" variant="body">{week}</WiseText>
      <WiseText color={raid.status === 'completed' ? 'accentPrimary' : 'textSecondary'} testID={`guild-past-raid-outcome-${raid.id}`} variant="body">
        {raid.status === 'completed' ? '✦ ' : ''}{outcome}
      </WiseText>
      <WiseText color="textSecondary" variant="body">{raid.progressXp} / {raid.goalXp} XP</WiseText>
      <WiseText testID={`guild-past-raid-mine-${raid.id}`} variant="body">{mine}</WiseText>
    </View>
  );
}

function PastRaidsCard({ guildId }: { guildId: string }) {
  const past = useInfiniteQuery(pastRaidsQueryOptions(guildId));
  const raids = past.data?.pages.flatMap((page) => page.items) ?? [];

  const body = (() => {
    if (past.isPending) return <WiseText color="textSecondary" testID="guild-past-raids-loading" variant="body">Carregando as Raids anteriores…</WiseText>;
    if (past.isError && !past.data) {
      return <View style={styles.stack} testID="guild-past-raids-error">
        <FeedbackMessage message="Não foi possível carregar as Raids anteriores." title="Histórico indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={past.isRefetching} onPress={() => void past.refetch()} variant="secondary" />
      </View>;
    }
    if (!raids.length) {
      return <WiseText color="textSecondary" testID="guild-past-raids-empty" variant="body">Nenhuma Raid encerrada ainda. A primeira fecha no fim desta semana.</WiseText>;
    }
    return <>
      {past.isError ? <FeedbackMessage message="Não foi possível atualizar o histórico." testID="guild-past-raids-stale" title="Dados desatualizados" variant="error" /> : null}
      {raids.map((raid) => <PastRaidItem key={raid.id} raid={raid} />)}
      {past.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais Raids." title="Lista incompleta" variant="error" /> : null}
      {past.hasNextPage
        ? <WiseButton label="Carregar mais" loading={past.isFetchingNextPage} onPress={() => void past.fetchNextPage()} testID="guild-past-raids-more" variant="ghost" />
        : null}
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Raids anteriores" role="region" testID="guild-past-raids">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Raids anteriores</WiseText>
        {body}
      </View>
    </WiseCard>
  );
}

/** The Raid of the week and, below it, its Ranking interno. The ranking only exists while there is a Raid to rank. */
function RaidSection({ compact, guildId }: { compact: boolean; guildId: string }) {
  const raid = useQuery(activeRaidQueryOptions(guildId));
  return (
    <View style={styles.stack}>
      <RaidCard desktop={!compact} guildId={guildId} />
      {raid.data ? <RankingCard compact={compact} guildId={guildId} key={raid.data.id} raidId={raid.data.id} /> : null}
    </View>
  );
}

type GuildActionCallbacks = { onConflict: (error: unknown) => void };

function CreateGuildCard({ onCreated, onConflict }: { onCreated: () => void } & GuildActionCallbacks) {
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
    <WiseCard accessibilityLabel="Criar guilda" role="region" testID="guild-create">
      <View aria-busy={create.isPending} style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Funde sua guilda</WiseText>
        <WiseText color="textSecondary" variant="body">Você será o líder e outros aventureiros poderão encontrá-la.</WiseText>
        <WiseField
          autoCapitalize="words"
          editable={!create.isPending}
          error={fieldError}
          label="Nome da guilda"
          maxLength={GUILD_NAME_MAX_LENGTH}
          nativeID="guild-create-name"
          onChangeText={setName}
          onSubmitEditing={submit}
          returnKeyType="done"
          value={name}
        />
        {create.isError ? <FeedbackMessage message={createGuildErrorMessage(create.error)} testID="guild-create-error" title="Guilda não criada" variant="error" /> : null}
        <WiseButton label="Criar guilda" loading={create.isPending} onPress={submit} testID="guild-create-submit" />
      </View>
    </WiseCard>
  );
}

function DirectoryItem({ busy, guild, onJoin }: { busy: boolean; guild: GuildSummary; onJoin: () => void }) {
  return (
    <View style={styles.directoryItem} testID={`guild-directory-item-${guild.id}`}>
      <View style={styles.directoryMain}>
        <WiseText variant="label">{guild.name}</WiseText>
        <WiseText color="textSecondary" variant="body">Nível {guild.level} · {formatMemberCount(guild.memberCount)}</WiseText>
      </View>
      <WiseButton accessibilityLabel={`Entrar na guilda ${guild.name}`} label="Entrar" loading={busy} onPress={onJoin} testID={`guild-join-${guild.id}`} variant="secondary" />
    </View>
  );
}

function DirectoryCard({ onJoined, onConflict }: { onJoined: () => void } & GuildActionCallbacks) {
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
      {guilds.map((guild) => (
        <DirectoryItem
          busy={join.isPending && join.variables === guild.id}
          guild={guild}
          key={guild.id}
          onJoin={() => { if (!join.isPending) { join.reset(); join.mutate(guild.id); } }}
        />
      ))}
      {directory.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais guildas." title="Lista incompleta" variant="error" /> : null}
      {directory.hasNextPage
        ? <WiseButton label="Carregar mais" loading={directory.isFetchingNextPage} onPress={() => void directory.fetchNextPage()} testID="guild-directory-more" variant="ghost" />
        : null}
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Encontrar guilda" role="region" testID="guild-directory">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Junte-se a uma guilda</WiseText>
        <WiseField
          autoCapitalize="none"
          label="Buscar por nome"
          maxLength={GUILD_NAME_MAX_LENGTH}
          nativeID="guild-directory-search"
          onChangeText={setDraft}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          value={draft}
        />
        <WiseButton label="Buscar" onPress={runSearch} testID="guild-directory-search-submit" variant="secondary" />
        {join.isError ? <FeedbackMessage message={joinGuildErrorMessage(join.error)} testID="guild-join-error" title="Não foi possível entrar" variant="error" /> : null}
        {body}
      </View>
    </WiseCard>
  );
}

function MemberGuild({ mine, desktop, onLeft, onConflict }: { mine: MyGuild; desktop: boolean; onLeft: () => void; onConflict: (error: unknown) => void }) {
  const { guild, role } = mine;
  const profile = useQuery(profileQueryOptions());
  const chat = useGuildChat(guild.id, profile.data?.id);
  // The tab is screen state, not a route: the Mural connection above lives in this component and is never remounted.
  const [tab, setTab] = useState<GuildTab>('raid');
  const header = (
    <View style={[styles.stack, desktop && styles.headerRow]} testID="guild-header">
      <View style={desktop ? styles.column : undefined}><GuildCard desktop={desktop} mine={mine} onlineUserIds={chat.onlineUserIds} /></View>
      <View style={desktop ? styles.leaveDesktop : undefined} testID="guild-leave-section">
        <LeaveGuildAction guildId={guild.id} isLeader={role === 'leader'} onConflict={onConflict} onLeft={onLeft} />
      </View>
    </View>
  );
  const raid = <RaidSection compact={!desktop} guildId={guild.id} />;
  const mural = <MuralPanel chat={chat} />;
  const members = <MembersCard guildId={guild.id} memberCount={guild.memberCount} onlineUserIds={chat.onlineUserIds} />;
  const pastRaids = <PastRaidsCard guildId={guild.id} />;
  const announcer = <MuralAnnouncer arrival={chat.arrival} />;
  if (desktop) {
    return <View style={styles.stack} testID="guild-layout-desktop">
      {header}
      <View style={styles.desktopGrid}>
        <View style={[styles.columnMain, styles.stack]} testID="guild-column-main">{raid}{pastRaids}</View>
        <View style={[styles.columnSide, styles.stack]} testID="guild-column-side">{mural}{members}</View>
      </View>
      {announcer}
    </View>;
  }
  const content = { raid, members, history: pastRaids }[tab as Exclude<GuildTab, 'mural'>];
  // The Mural stays mounted and is only hidden, so the unsent draft and the scroll position survive a tab change.
  return <View style={[styles.stack, styles.grow]} testID="guild-layout-tabs">
    {header}
    <GuildTabs onSelect={setTab} selected={tab} />
    <View style={[styles.stack, styles.grow]} testID="guild-tab-content">
      <View style={tab === 'mural' ? undefined : styles.hidden}>{mural}</View>
      {tab === 'mural' ? null : content}
    </View>
    {announcer}
  </View>;
}

export function GuildScreen() {
  const mine = useQuery(myGuildQueryOptions());
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const refreshGuild = () => queryClient.invalidateQueries({ queryKey: guildKeys.all });
  // A 409 (or a 404 on leave) can mean the user's guild changed elsewhere: reload so the screen reflects it.
  const refreshOnConflict = (error: unknown) => {
    if (isApiError(error) && (error.category === 'conflict' || error.status === 404)) void queryClient.invalidateQueries({ queryKey: guildKeys.mine() });
  };

  if (mine.isPending) {
    return (
      <Screen safeAreaEdges={[]} testID="guild" title="Guilda">
        <View accessibilityLabel="Carregando sua guilda" accessibilityState={{ busy: true }} aria-busy style={styles.stack} testID="guild-loading">
          <WiseText variant="body">Carregando sua guilda…</WiseText>
          <ProgressBar indeterminate accessibilityLabel="Carregando sua guilda" />
        </View>
      </Screen>
    );
  }
  if (mine.isError && mine.data === undefined) {
    return (
      <Screen safeAreaEdges={[]} testID="guild" title="Guilda">
        <View style={styles.stack} testID="guild-error">
          <FeedbackMessage message="Não foi possível carregar sua guilda." title="Guilda indisponível" variant="error" />
          <WiseButton label="Tentar novamente" loading={mine.isRefetching} onPress={() => void mine.refetch()} />
        </View>
      </Screen>
    );
  }

  const desktop = isDesktopLayout(Platform.OS, width);
  return (
    <Screen contentContainerStyle={mine.data ? styles.fromTop : undefined} contentStyle={mine.data ? styles.grow : undefined} safeAreaEdges={[]} testID="guild" title="Guilda">
      {mine.isError ? <FeedbackMessage message="Não foi possível atualizar sua guilda." testID="guild-refresh-error" title="Dados desatualizados" variant="error" /> : null}
      {mine.data
        ? <MemberGuild key={mine.data.guild.id} desktop={desktop} mine={mine.data} onConflict={refreshOnConflict} onLeft={() => void refreshGuild()} />
        : <View style={[styles.grid, desktop && styles.desktopGrid]}>
          <View style={styles.column}><CreateGuildCard onConflict={refreshOnConflict} onCreated={() => void refreshGuild()} /></View>
          <View style={styles.column}><DirectoryCard onConflict={refreshOnConflict} onJoined={() => void refreshGuild()} /></View>
        </View>}
    </Screen>
  );
}

const { fontFamily: mono } = theme.type.mono;
const { fontFamily: sans } = theme.type.label;

const styles = StyleSheet.create({
  stack: { gap: theme.space.stackDefault },
  grid: { gap: theme.space.stackDefault },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.stackDefault },
  column: { flex: 1 },
  hidden: { display: 'none' },
  grow: { flexGrow: 1 },
  // The Screen centers its content; a guild screen starts at the top and its open tab runs down to the bottom.
  fromTop: { justifyContent: 'flex-start' },
  // Figma 06c desktop: a 680 px main column and a 392 px side column.
  columnMain: { flex: 680 },
  columnSide: { flex: 392 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackDefault },
  leaveDesktop: { width: 199 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackDefault },
  identityText: { flex: 1, gap: theme.space.inlineTight },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space.stackTight },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: theme.space.stackTight, rowGap: theme.space.inlineHairline },
  rolePill: { paddingVertical: theme.space.inlineHairline, paddingHorizontal: theme.space.inlineTight, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  rolePillLeader: { borderColor: theme.color.accentPrimary },
    pastRaidItem: { gap: theme.space.inlineHairline, paddingVertical: theme.space.inlineTight, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle },

  cardContent: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  directoryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  directoryMain: { flex: 1, gap: theme.space.inlineHairline },
  // Figma 06c Membros: 30 px portrait, 9 px Presença dot on its bottom-right corner, 31 px rows.
  membersBlock: { gap: theme.space.stackTight },
  membersCard: { padding: theme.space.cardInset, gap: 12 },
  membersCount: { fontFamily: mono, fontSize: 10, letterSpacing: 0.8, color: theme.color.textTertiary },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 31 },
  memberAvatar: { width: 30, height: 30 },
  memberPortrait: { width: 30, height: 30 },
  memberPresence: { position: 'absolute', left: 23, top: 23 },
  memberText: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { fontFamily: sans, fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  memberNameOffline: { color: theme.color.textSecondary },
  memberDetail: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textTertiary },
  memberSeal: { fontFamily: mono, fontSize: 9, letterSpacing: 0.8, color: theme.color.accentPrimary },
});
