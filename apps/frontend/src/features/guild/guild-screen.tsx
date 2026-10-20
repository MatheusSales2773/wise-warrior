import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseField, WiseText, isDesktopLayout, theme } from '@/design-system';
import { isApiError } from '@/core/api/api-error';
import { createGuild, joinGuild, joinRaid, leaveGuild, type ActiveRaid, type GuildMember, type GuildSummary, type MyGuild, type PastRaid } from './api';
import {
  RAID_GOAL_REACHED, RAID_REWARD_RULE, createGuildErrorMessage, formatPastRaidMine, formatPastRaidOutcome, formatRaidWeek, formatGuildRole, formatMyContribution, formatMyPosition, formatMemberCount, formatRaidTimeLeft, formatRewardCategory, formatRewardCoins,
  joinGuildErrorMessage, joinRaidErrorMessage, leaveGuildErrorMessage, raidProgressPercent,
} from './messages';
import { activeRaidQueryOptions, guildDirectoryQueryOptions, guildKeys, guildMembersQueryOptions, myGuildQueryOptions, pastRaidsQueryOptions } from './queries';
import { profileQueryOptions } from '@/features/dashboard/queries';
import { useGuildChat } from './guild-chat';
import { GuildTabs, MuralAnnouncer, MuralPanel, OnlineIndicator, PresenceDot, type GuildTab } from './guild-mural';
import { RankingCard } from './guild-ranking';
import { RaidScene } from './raid-scene';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH } from './raid-scene-sprites';
import { GUILD_NAME_MAX_LENGTH, normalizeGuildName, validateGuildName } from './validation';

/** The smallest whole scale that fills the card width; the scene is cropped at the sides instead of letterboxed. */
function thumbnailScale(width: number): number {
  return Math.min(6, Math.max(2, Math.ceil(width / RAID_SCENE_WIDTH)));
}

function MemberItem({ member, online }: { member: GuildMember; online: boolean | null }) {
  const detail = [`Nível ${member.level}`, member.title].filter(Boolean).join(' · ');
  const presence = online === null ? '' : online ? ', online' : ', offline';
  return (
    <View accessible accessibilityLabel={`${member.displayName}${presence}, ${formatGuildRole(member.role)}. ${detail}`} style={styles.directoryItem} testID={`guild-member-${member.userId}`}>
      <View style={styles.directoryMain}>
        <View style={styles.memberName}>
          {online === null ? null : <PresenceDot online={online} testID={`guild-member-${online ? 'online' : 'offline'}-${member.userId}`} />}
          <WiseText variant="label">{member.displayName}</WiseText>
        </View>
        <WiseText color="textSecondary" variant="body">{detail}</WiseText>
      </View>
      {member.role === 'leader' ? <WiseText color="accentPrimary" variant="caption">LÍDER</WiseText> : null}
    </View>
  );
}

function MembersCard({ guildId, onlineUserIds }: { guildId: string; onlineUserIds: ReadonlySet<string> | null }) {
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
    return <>
      {items.map((member) => <MemberItem key={member.userId} member={member} online={onlineUserIds ? onlineUserIds.has(member.userId) : null} />)}
      {members.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais membros." title="Lista incompleta" variant="error" /> : null}
      {members.hasNextPage
        ? <WiseButton label="Carregar mais membros" loading={members.isFetchingNextPage} onPress={() => void members.fetchNextPage()} testID="guild-members-more" variant="ghost" />
        : null}
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Membros da guilda" role="region" testID="guild-members">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Membros</WiseText>
        {body}
      </View>
    </WiseCard>
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

function GuildCard({ mine, onlineUserIds }: { mine: MyGuild; onlineUserIds: ReadonlySet<string> | null }) {
  const { guild, role } = mine;
  return (
    <WiseCard accessibilityLabel="Sua guilda" role="region" testID="guild-mine" variant="ornamented">
      <View style={styles.cardContent}>
        <WiseText color="accentPrimary" variant="caption">{formatGuildRole(role).toUpperCase()}</WiseText>
        <WiseText accessibilityRole="header" aria-level={2} testID="guild-mine-name" variant="subtitle">{guild.name}</WiseText>
        <WiseText testID="guild-mine-level" variant="body">Nível {guild.level}</WiseText>
        <WiseText color="textSecondary" testID="guild-mine-members" variant="body">{formatMemberCount(guild.memberCount)}</WiseText>
        <OnlineIndicator onlineUserIds={onlineUserIds} />
        {guild.leader ? <WiseText color="textSecondary" testID="guild-mine-leader" variant="body">Líder: {guild.leader.displayName}</WiseText> : null}
      </View>
    </WiseCard>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function RaidParticipation({ guildId, raid }: { guildId: string; raid: ActiveRaid }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinRaid(raid.id),
    onSuccess: () => {
      queryClient.setQueryData<ActiveRaid | null>(
        guildKeys.raid(guildId),
        (current) => (current ? { ...current, me: { ...current.me, participating: true } } : current),
      );
      // The new Participant enters the Ranking interno with 0 XP. The Raid itself is not refetched.
      void queryClient.invalidateQueries({ queryKey: guildKeys.raidRanking(guildId, raid.id) });
    },
    // The Raid ended (409) or is gone: show the Raid that is current now.
    onError: (error) => {
      if (isApiError(error) && (error.category === 'conflict' || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: guildKeys.raid(guildId) });
      }
    },
  });

  if (raid.me.participating) {
    return (
      <View style={styles.stack}>
        <WiseText accessibilityLiveRegion="polite" color="accentPrimary" testID="guild-raid-participating" variant="label">Você está nesta Raid</WiseText>
        <WiseText testID="guild-raid-my-contribution" variant="body">{formatMyContribution(raid.me.contributionXp)}</WiseText>
        {formatMyPosition(raid.me.position) ? <WiseText testID="guild-raid-my-position" variant="body">{formatMyPosition(raid.me.position)}</WiseText> : null}
      </View>
    );
  }
  if (raid.status === 'expired') return null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.stack}>
      {join.isError ? <FeedbackMessage message={joinRaidErrorMessage(join.error)} testID="guild-raid-join-error" title="Participação não confirmada" variant="error" /> : null}
      <WiseButton label="Participar" loading={join.isPending} onPress={() => { if (!join.isPending) { join.reset(); join.mutate(); } }} testID="guild-raid-join" />
    </View>
  );
}

/** The Raid scene without the party, cropped to the card. Decorative: the card text says everything it shows. */
function RaidThumbnail() {
  const [width, setWidth] = useState(0);
  return (
    <View
      accessibilityElementsHidden
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.raidImage, width > 0 && { height: RAID_SCENE_HEIGHT * thumbnailScale(width) }]}
      testID="guild-raid-image"
    >
      {width > 0 ? <RaidScene party={[]} scale={thumbnailScale(width)} showTags={false} viewportWidth={width} /> : null}
    </View>
  );
}

function RaidDetails({ guildId, raid }: { guildId: string; raid: ActiveRaid }) {
  const now = useNow(30_000);
  // The Meta batida takes the goal plus what the Fúria gave back to the boss.
  const neededXp = raid.goalXp + raid.regeneratedXp;
  const percent = raidProgressPercent(raid.progressXp, neededXp);
  return (
    <>
      <RaidThumbnail />
      <WiseText accessibilityRole="header" aria-level={3} variant="label">{raid.mission.name}</WiseText>
      <WiseText color="textSecondary" variant="body">{raid.mission.description}</WiseText>
      <View style={styles.stack}>
        <ProgressBar
          accessibilityLabel={`Progresso da Raid: ${raid.progressXp} de ${neededXp} XP, ${percent}%`}
          maximumValue={neededXp}
          size="tall"
          testID="guild-raid-progress"
          value={Math.min(raid.progressXp, neededXp)}
        />
        <WiseText variant="body">{raid.progressXp} / {neededXp} XP</WiseText>
        {raid.goalReachedAt ? (
          <WiseText accessibilityLiveRegion="polite" color="accentPrimary" testID="guild-raid-goal-reached" variant="label">
            {RAID_GOAL_REACHED}
          </WiseText>
        ) : null}
      </View>
      <WiseText color="textSecondary" testID="guild-raid-time-left" variant="body">{formatRaidTimeLeft(new Date(raid.endsAt).getTime() - now)}</WiseText>
      <View style={styles.stack} testID="guild-raid-reward">
        <WiseText color="accentPrimary" variant="caption">RECOMPENSA DE RAID</WiseText>
        {raid.rewards.map((reward) => <View key={reward.itemId}>
          <WiseText variant="label">{reward.name}</WiseText>
          <WiseText color="textSecondary" variant="body">{formatRewardCategory(reward.category)}</WiseText>
        </View>)}
        <WiseText color="textSecondary" variant="body">{formatRewardCoins(raid.coins)}</WiseText>
        <WiseText color="textSecondary" variant="caption">{RAID_REWARD_RULE}</WiseText>
      </View>
      <RaidParticipation guildId={guildId} raid={raid} />
      <Link asChild href="/guilda/raid">
        <WiseButton accessibilityLabel={`Ver a batalha da Raid ${raid.mission.name}`} label="Ver batalha" testID="guild-raid-battle" variant="secondary" />
      </Link>
    </>
  );
}

function RaidCard({ guildId }: { guildId: string }) {
  const raid = useQuery(activeRaidQueryOptions(guildId));

  const body = (() => {
    if (raid.isPending) return <WiseText color="textSecondary" testID="guild-raid-loading" variant="body">Carregando a Raid da semana…</WiseText>;
    if (raid.isError && raid.data === undefined) {
      return <View style={styles.stack} testID="guild-raid-error">
        <FeedbackMessage message="Não foi possível carregar a Raid da semana." title="Raid indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={raid.isRefetching} onPress={() => void raid.refetch()} variant="secondary" />
      </View>;
    }
    if (!raid.data) {
      return <WiseText color="textSecondary" testID="guild-raid-empty" variant="body">Sua guilda ainda não tem uma Raid nesta semana. Volte em breve.</WiseText>;
    }
    return <>
      {raid.isError ? <FeedbackMessage message="Não foi possível atualizar a Raid." testID="guild-raid-stale" title="Dados desatualizados" variant="error" /> : null}
      <RaidDetails guildId={guildId} raid={raid.data} />
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Raid da semana" role="region" testID="guild-raid">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Raid da semana</WiseText>
        {body}
      </View>
    </WiseCard>
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
      <RaidCard guildId={guildId} />
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
      <View style={desktop ? styles.column : undefined}><GuildCard mine={mine} onlineUserIds={chat.onlineUserIds} /></View>
      <View testID="guild-leave-section">
        <LeaveGuildAction guildId={guild.id} isLeader={role === 'leader'} onConflict={onConflict} onLeft={onLeft} />
      </View>
    </View>
  );
  const raid = <RaidSection compact={!desktop} guildId={guild.id} />;
  const mural = <MuralPanel chat={chat} />;
  const members = <MembersCard guildId={guild.id} onlineUserIds={chat.onlineUserIds} />;
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  raidImage: { height: 160, overflow: 'hidden', borderRadius: theme.radius.card, backgroundColor: theme.color.surfaceInset },
  pastRaidItem: { gap: theme.space.inlineHairline, paddingVertical: theme.space.inlineTight, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle },

  cardContent: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  directoryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  directoryMain: { flex: 1, gap: theme.space.inlineHairline },
  memberName: { flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight },
});
