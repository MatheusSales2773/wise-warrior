import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseText, isDesktopLayout, theme } from '@/design-system';
import { formatDiscardReason, formatDuration, formatSessionDate, formatXp } from './formatters';
import type { RecentStudySession } from './api';
import { profileQueryOptions, recentActivityQueryOptions } from './queries';

function ActivityCard({ query }: { query: UseQueryResult<RecentStudySession[]> }) {
  const retryInFlight = useRef<Promise<unknown> | null>(null);
  const retry = () => {
    if (retryInFlight.current) return retryInFlight.current;
    const request = query.refetch().finally(() => { retryInFlight.current = null; });
    retryInFlight.current = request;
    return request;
  };

  if (query.isPending && !query.data) return <WiseCard testID="dashboard-activity-loading"><WiseText variant="body">Carregando sessões recentes…</WiseText></WiseCard>;
  if (query.isError && !query.data) return <WiseCard testID="dashboard-activity-error"><FeedbackMessage variant="error" title="Atividade indisponível" message="Não foi possível carregar suas sessões concluídas." /><WiseButton label="Tentar novamente" variant="secondary" loading={query.isRefetching} onPress={() => void retry()} /></WiseCard>;

  const sessions = query.data ?? [];
  return <WiseCard testID={sessions.length ? 'dashboard-activity' : 'dashboard-activity-empty'}>
    <WiseText variant="subtitle">Atividade recente</WiseText>
    {sessions.length ? sessions.slice(0, 5).map((session) => <View key={session.id} accessible style={styles.activityItem}>
      <WiseText variant="label">{session.subject}</WiseText>
      <WiseText variant="caption" color="textSecondary">{session.mode} · {formatSessionDate(session.endedAt)}</WiseText>
      <WiseText variant="body">{formatDuration(session.durationValidSeconds)} · {formatXp(session.xpAwarded)} XP</WiseText>
      {session.discardedReason ? <WiseText variant="caption" color="feedbackDanger">{formatDiscardReason(session.discardedReason)}</WiseText> : null}
    </View>) : <WiseText variant="body">Nenhuma sessão concluída ainda. Suas sessões concluídas aparecerão aqui.</WiseText>}
    {query.isRefetching ? <WiseText testID="dashboard-activity-refreshing" variant="caption" color="textSecondary">Atualizando atividade…</WiseText> : null}
    {query.isError ? <View testID="dashboard-activity-refresh-error"><FeedbackMessage variant="error" title="Atividade desatualizada" message="Não foi possível atualizar suas sessões concluídas." /><WiseButton label="Tentar novamente" variant="secondary" loading={query.isRefetching} onPress={() => void retry()} /></View> : null}
  </WiseCard>;
}

export function DashboardScreen() {
  const profile = useQuery(profileQueryOptions());
  const activity = useQuery(recentActivityQueryOptions());
  const { width } = useWindowDimensions();
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshing = profile.isRefetching || activity.isRefetching;
  const statusMessage = refreshing ? 'Atualizando dados' : refreshSucceeded ? 'Dados atualizados' : profile.isError || activity.isError ? 'Alguns dados não foram atualizados.' : null;
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
      <Screen title="Acampamento" testID="dashboard">
        <View
          accessible
          accessibilityLabel="Carregando seu painel"
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: true }}
          aria-busy
          testID="dashboard-loading"
        >
          <WiseText variant="body">Carregando seu painel…</WiseText>
        </View>
      </Screen>
    );
  }
  if (profile.isError && !profile.data) return <Screen title="Acampamento" testID="dashboard"><FeedbackMessage variant="error" title="Painel indisponível" message="Não foi possível carregar seu progresso." /><WiseButton label="Tentar novamente" onPress={() => void profile.refetch()} /></Screen>;
  const user = profile.data;
  if (!user) return null;
  const desktop = isDesktopLayout(Platform.OS, width);
  const refreshProps = Platform.OS === 'web' ? {} : { refreshing, onRefresh: () => { void refresh(); } };
  return <Screen title="Acampamento" testID="dashboard" {...refreshProps}>
    <View accessibilityLiveRegion="polite" style={styles.status}>{statusMessage ? <WiseText variant="caption" color={refreshing ? 'textSecondary' : refreshSucceeded ? 'feedbackSuccess' : 'feedbackDanger'}>{statusMessage}</WiseText> : null}</View>
    {Platform.OS === 'web' ? <WiseButton label="Atualizar dados" variant="secondary" loading={refreshing} onPress={() => void refresh()} /> : null}
    <View style={[styles.grid, desktop && styles.desktopGrid]}>
      <View style={styles.mainColumn}>
        <WiseCard variant="ornamented" testID="dashboard-profile"><WiseText variant="subtitle">Boas-vindas, {user.displayName}</WiseText>{user.title ? <WiseText variant="body" color="textSecondary">{user.title}</WiseText> : null}</WiseCard>
        <WiseCard variant="elevated" testID="dashboard-progression"><WiseText variant="subtitle">Nível {user.level}</WiseText><WiseText variant="body">{formatXp(user.xpTotal)} XP total</WiseText><ProgressBar minimumValue={user.levelStartXp} maximumValue={user.nextLevelXp} value={user.xpTotal} accessibilityLabel={`Progresso para o nível ${user.level + 1}`} testID="dashboard-progress" /><WiseText variant="caption" color="textSecondary">{formatXp(user.xpTotal - user.levelStartXp)} XP no nível · faltam {formatXp(user.nextLevelXp - user.xpTotal)} XP</WiseText></WiseCard>
      </View>
      <View style={styles.sideColumn}><ActivityCard query={activity} /></View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  status: { minHeight: 20, marginBottom: theme.space.stackTight },
  grid: { width: '100%', gap: theme.space.sectionGap },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 2, gap: theme.space.sectionGap },
  sideColumn: { flex: 1 },
  activityItem: { borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSoft, paddingVertical: theme.space.stackTight, gap: theme.space.inlineHairline },
});
