import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseText, isDesktopLayout, theme } from '@/design-system';
import { formatDiscardReason, formatDuration, formatSessionDate, formatXp } from './formatters';
import type { RecentStudySession } from './api';
import { profileQueryOptions, recentActivityQueryOptions } from './queries';

function SectionHeading({ children }: PropsWithChildren) {
  return <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">{children}</WiseText>;
}

function CardContent({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return <View style={styles.cardContent} testID={testID}>{children}</View>;
}

function ActivityItem({ session }: { session: RecentStudySession }) {
  const display = {
    date: formatSessionDate(session.endedAt),
    discarded: session.discardedReason ? formatDiscardReason(session.discardedReason) : null,
    duration: formatDuration(session.durationValidSeconds),
    mode: session.mode,
    subject: session.subject,
    xp: `${formatXp(session.xpAwarded)} XP`,
  };
  const details = [
    display.subject,
    display.mode,
    display.date,
    display.duration,
    display.xp,
    display.discarded,
  ].filter(Boolean).join(' · ');

  return (
    <View accessible accessibilityLabel={`Sessão: ${details}`} key={session.id} style={styles.activityItem}>
      <WiseText variant="label">{display.subject}</WiseText>
      <WiseText color="textSecondary" variant="caption">{display.mode} · {display.date}</WiseText>
      <WiseText variant="body">{display.duration} · {display.xp}</WiseText>
      {display.discarded ? <WiseText color="feedbackDanger" variant="caption">{display.discarded}</WiseText> : null}
    </View>
  );
}

function ProfileRefreshError({ query }: { query: UseQueryResult<unknown> }) {
  if (!query.isError || !query.data) return null;

  return (
    <View style={styles.inlineError} testID="dashboard-profile-refresh-error">
      <FeedbackMessage message="Não foi possível atualizar seu progresso." title="Progresso desatualizado" variant="error" />
      <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void query.refetch()} variant="secondary" />
    </View>
  );
}

function ActivityCard({ query }: { query: UseQueryResult<RecentStudySession[]> }) {
  const retryInFlight = useRef<Promise<unknown> | null>(null);
  const retry = () => {
    if (retryInFlight.current) return retryInFlight.current;
    const request = query.refetch().finally(() => { retryInFlight.current = null; });
    retryInFlight.current = request;
    return request;
  };

  if (query.isPending && !query.data) {
    return (
      <WiseCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-loading">
        <CardContent>
          <SectionHeading>Atividade recente</SectionHeading>
          <WiseText variant="body">Carregando sessões recentes…</WiseText>
        </CardContent>
      </WiseCard>
    );
  }

  if (query.isError && !query.data) {
    return (
      <WiseCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-error">
        <CardContent>
          <SectionHeading>Atividade recente</SectionHeading>
          <FeedbackMessage message="Não foi possível carregar suas sessões concluídas." title="Atividade indisponível" variant="error" />
          <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" />
        </CardContent>
      </WiseCard>
    );
  }

  const sessions = query.data ?? [];
  return (
    <WiseCard accessibilityLabel="Atividade recente" role="region" testID={sessions.length ? 'dashboard-activity' : 'dashboard-activity-empty'}>
      <CardContent>
        <SectionHeading>Atividade recente</SectionHeading>
        {sessions.length
          ? sessions.slice(0, 5).map((session) => <ActivityItem key={session.id} session={session} />)
          : <WiseText variant="body">Nenhuma sessão concluída ainda. Suas sessões concluídas aparecerão aqui.</WiseText>}
        {query.isRefetching ? <WiseText color="textSecondary" testID="dashboard-activity-refreshing" variant="caption">Atualizando atividade…</WiseText> : null}
        {query.isError ? (
          <View style={styles.activityRefreshError} testID="dashboard-activity-refresh-error">
            <FeedbackMessage message="Não foi possível atualizar suas sessões concluídas." title="Atividade desatualizada" variant="error" />
            <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" />
          </View>
        ) : null}
      </CardContent>
    </WiseCard>
  );
}

export function DashboardScreen() {
  const profile = useQuery(profileQueryOptions());
  const activity = useQuery(recentActivityQueryOptions());
  const { width } = useWindowDimensions();
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshInProgress = useRef(false);
  const refreshing = profile.isRefetching || activity.isRefetching;
  const statusMessage = refreshing ? 'Atualizando dados' : refreshSucceeded ? 'Dados atualizados' : null;
  const partialErrorMessage = profile.isError || activity.isError ? 'Alguns dados não foram atualizados.' : null;
  const refresh = async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    setRefreshSucceeded(false);
    const request = Promise.all([profile.refetch(), activity.refetch()])
      .then((results) => setRefreshSucceeded(results.every((query) => !query.isError)))
      .finally(() => { refreshInFlight.current = null; });
    refreshInFlight.current = request;
    return request;
  };

  useEffect(() => {
    if (refreshing) {
      refreshInProgress.current = true;
      return;
    }
    if (!refreshInProgress.current) return;
    refreshInProgress.current = false;
    setRefreshSucceeded(!profile.isError && !activity.isError);
  }, [activity.isError, profile.isError, refreshing]);

  useEffect(() => {
    if (!refreshSucceeded) return;
    const timeout = setTimeout(() => setRefreshSucceeded(false), 4_000);
    return () => clearTimeout(timeout);
  }, [refreshSucceeded]);

  useEffect(() => {
    if (Platform.OS === 'ios' && statusMessage) {
      AccessibilityInfo.announceForAccessibilityWithOptions(statusMessage, { queue: true });
    }
  }, [statusMessage]);

  if (profile.isPending && !profile.data) {
    return (
      <Screen safeAreaEdges={[]} title="Acampamento" testID="dashboard">
        <View
          accessibilityLabel="Carregando seu painel"
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: true }}
          aria-atomic
          aria-busy
          aria-live="polite"
          style={styles.loading}
          testID="dashboard-loading"
        >
          <WiseText variant="body">Carregando seu painel…</WiseText>
          <ProgressBar indeterminate accessibilityLabel="Carregando seu painel" testID="dashboard-loading-progress" />
        </View>
      </Screen>
    );
  }
  if (profile.isError && !profile.data) {
    return (
      <Screen safeAreaEdges={[]} title="Acampamento" testID="dashboard">
        <View style={styles.errorContent}>
          <FeedbackMessage message="Não foi possível carregar seu progresso." title="Painel indisponível" variant="error" />
          <WiseButton label="Tentar novamente" onPress={() => void profile.refetch()} />
        </View>
      </Screen>
    );
  }
  const user = profile.data;
  if (!user) return null;
  const desktop = isDesktopLayout(Platform.OS, width);
  const refreshProps = Platform.OS === 'web' ? {} : { refreshing, onRefresh: () => { void refresh(); } };
  return <Screen safeAreaEdges={[]} title="Acampamento" testID="dashboard" {...refreshProps}>
    <View testID="dashboard-status" accessibilityLiveRegion="polite" aria-live="polite" aria-atomic style={styles.status}>{statusMessage ? <WiseText variant="caption" color={refreshing ? 'textSecondary' : 'feedbackSuccess'}>{statusMessage}</WiseText> : null}</View>
    {partialErrorMessage ? <View accessibilityLiveRegion="none" aria-live="off" style={styles.partialError} testID="dashboard-partial-error"><WiseText color="feedbackDanger" variant="caption">{partialErrorMessage}</WiseText></View> : null}
    {Platform.OS === 'web' ? <View style={styles.refreshAction}><WiseButton label="Atualizar dados" loading={refreshing} onPress={() => void refresh()} variant="secondary" /></View> : null}
    <View testID="dashboard-grid" style={[styles.grid, desktop && styles.desktopGrid]}>
      <View testID="dashboard-main-column" style={styles.mainColumn}>
        <WiseCard accessibilityLabel="Resumo de perfil" role="region" testID="dashboard-profile" variant="ornamented">
          <CardContent testID="dashboard-profile-content">
            <SectionHeading>Boas-vindas, {user.displayName}</SectionHeading>
            {user.title ? <WiseText color="textSecondary" variant="body">{user.title}</WiseText> : null}
          </CardContent>
        </WiseCard>
        <ProfileRefreshError query={profile} />
        <WiseCard accessibilityLabel="Progressão" role="region" testID="dashboard-progression" variant="elevated">
          <CardContent>
            <SectionHeading>Nível {user.level}</SectionHeading>
            <WiseText variant="body">{formatXp(user.xpTotal)} XP total</WiseText>
            <ProgressBar accessibilityLabel={`Progresso para o nível ${user.level + 1}`} maximumValue={user.nextLevelXp} minimumValue={user.levelStartXp} testID="dashboard-progress" value={user.xpTotal} />
            <WiseText color="textSecondary" variant="caption">{formatXp(user.xpTotal - user.levelStartXp)} XP no nível · faltam {formatXp(user.nextLevelXp - user.xpTotal)} XP</WiseText>
          </CardContent>
        </WiseCard>
      </View>
      <View style={styles.sideColumn} testID="dashboard-side-column"><ActivityCard query={activity} /></View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  errorContent: { gap: theme.space.stackDefault },
  inlineError: { gap: theme.space.stackDefault },
  status: { minHeight: 20, marginBottom: theme.space.stackTight },
  partialError: { marginBottom: theme.space.stackTight },
  refreshAction: { alignSelf: 'flex-start', marginBottom: theme.space.sectionGap },
  grid: { width: '100%', flexDirection: 'column', gap: theme.space.sectionGap },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 2, minWidth: 0, gap: theme.space.sectionGap },
  sideColumn: { flex: 1, minWidth: 0 },
  cardContent: { minWidth: 0, padding: theme.space.cardInset, gap: theme.space.stackTight },
  activityItem: { minWidth: 0, borderTopColor: theme.color.borderSoft, borderTopWidth: theme.border.standard, gap: theme.space.inlineHairline, paddingVertical: theme.space.stackTight },
  activityRefreshError: { gap: theme.space.stackDefault, marginTop: theme.space.stackTight },
});
