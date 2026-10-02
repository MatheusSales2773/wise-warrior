import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseField, WiseText, isDesktopLayout, theme } from '@/design-system';
import { isApiError } from '@/core/api/api-error';
import { createGuild, joinGuild, type GuildSummary, type MyGuild } from './api';
import { createGuildErrorMessage, formatGuildRole, formatMemberCount, joinGuildErrorMessage } from './messages';
import { guildDirectoryQueryOptions, guildKeys, myGuildQueryOptions } from './queries';
import { GUILD_NAME_MAX_LENGTH, normalizeGuildName, validateGuildName } from './validation';

function GuildCard({ mine }: { mine: MyGuild }) {
  const { guild, role } = mine;
  return (
    <WiseCard accessibilityLabel="Sua guilda" role="region" testID="guild-mine" variant="ornamented">
      <View style={styles.cardContent}>
        <WiseText color="accentPrimary" variant="caption">{formatGuildRole(role).toUpperCase()}</WiseText>
        <WiseText accessibilityRole="header" aria-level={2} testID="guild-mine-name" variant="subtitle">{guild.name}</WiseText>
        <WiseText testID="guild-mine-level" variant="body">Nível {guild.level}</WiseText>
        <WiseText color="textSecondary" testID="guild-mine-members" variant="body">{formatMemberCount(guild.memberCount)}</WiseText>
      </View>
    </WiseCard>
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

export function GuildScreen() {
  const mine = useQuery(myGuildQueryOptions());
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const refreshGuild = () => queryClient.invalidateQueries({ queryKey: guildKeys.all });
  // A 409 can mean the user already joined a guild elsewhere: reload so the screen reflects it.
  const refreshOnConflict = (error: unknown) => {
    if (isApiError(error) && error.category === 'conflict') void queryClient.invalidateQueries({ queryKey: guildKeys.mine() });
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
    <Screen safeAreaEdges={[]} testID="guild" title="Guilda">
      {mine.isError ? <FeedbackMessage message="Não foi possível atualizar sua guilda." testID="guild-refresh-error" title="Dados desatualizados" variant="error" /> : null}
      {mine.data
        ? <GuildCard mine={mine.data} />
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
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  cardContent: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  directoryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  directoryMain: { flex: 1, gap: theme.space.inlineHairline },
});
