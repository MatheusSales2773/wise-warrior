import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseText, isDesktopLayout, theme } from '@/design-system';
import { formatCadenceDate, formatDiscardReason, formatDuration, formatSessionDate, formatXp } from './formatters';
import type { CadenceDay, RecentStudySession, SessionMetrics } from './api';
import { profileQueryOptions, recentActivityQueryOptions, sessionMetricsQueryOptions } from './queries';

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
    status: formatSessionState(session.state),
    subject: session.subject,
    xp: `${formatXp(session.xpAwarded)} XP`,
  };
  const details = [
    display.status,
    display.subject,
    display.mode,
    display.date,
    display.duration,
    display.xp,
    display.discarded,
  ].filter(Boolean).join(' · ');

  return (
    <View accessible accessibilityLabel={`Sessão: ${details}`} key={session.id} style={styles.activityItem}>
      {display.subject ? <WiseText variant="label">{display.subject}</WiseText> : null}
      <WiseText color="textSecondary" variant="caption">{display.status ? `${display.status} · ` : ''}{display.mode} · {display.date}</WiseText>
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
          <FeedbackMessage message="Não foi possível carregar suas sessões recentes." title="Atividade indisponível" variant="error" />
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
          : <WiseText variant="body">Nenhuma sessão encerrada ainda. Suas sessões encerradas aparecerão aqui.</WiseText>}
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

function MetricsCard({ query }: { query: UseQueryResult<SessionMetrics> }) {
  const retryInFlight = useRef<Promise<unknown> | null>(null);
  const retry = () => {
    if (retryInFlight.current) return retryInFlight.current;
    const request = query.refetch().finally(() => { retryInFlight.current = null; });
    retryInFlight.current = request;
    return request;
  };
  if (query.isPending && !query.data) {
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-loading"><CardContent><SectionHeading>Ritmo de treino</SectionHeading><WiseText variant="body">Carregando suas métricas…</WiseText></CardContent></WiseCard>;
  }
  if (query.isError && !query.data) {
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-error"><CardContent><SectionHeading>Ritmo de treino</SectionHeading><FeedbackMessage message="Não foi possível carregar suas métricas de treino." title="Métricas indisponíveis" variant="error" /><WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" /></CardContent></WiseCard>;
  }

  const metrics = query.data;
  if (!metrics) return null;
  const goal = Math.max(0, metrics.dailyGoal);
  return <View style={styles.metricsGrid} testID="dashboard-metrics">
    <WiseCard accessibilityLabel={`Streak: ${metrics.currentStreakDays} dias; recorde pessoal de ${metrics.longestStreakDays} dias`} role="region" style={styles.metricCard} testID="dashboard-streak" variant="elevated">
      <CardContent>
        <SectionHeading>Streak</SectionHeading>
        <MetricValue label="Sequência atual" value={formatDayCount(metrics.currentStreakDays)} />
        <WiseText color="textSecondary" variant="caption">Recorde pessoal: {formatDayCount(metrics.longestStreakDays)}</WiseText>
      </CardContent>
    </WiseCard>
    <WiseCard accessibilityLabel={`Sessões hoje: ${metrics.sessionsToday}${goal ? ` de ${goal}` : ''}; ${formatDuration(metrics.validSecondsToday)} de foco válido`} role="region" style={styles.metricCard} testID="dashboard-sessions" variant="default">
      <CardContent>
        <SectionHeading>Sessões hoje</SectionHeading>
        <MetricValue label="Sessões elegíveis" value={`${metrics.sessionsToday}${goal ? ` / ${goal}` : ''}`} />
        <WiseText color="textSecondary" variant="caption">{formatDuration(metrics.validSecondsToday)} de foco válido</WiseText>
      </CardContent>
    </WiseCard>
    <View style={styles.metricsStatus}>
      {query.isRefetching ? <WiseText color="textSecondary" testID="dashboard-metrics-refreshing" variant="caption">Atualizando métricas…</WiseText> : null}
      {query.isError ? <View testID="dashboard-metrics-refresh-error"><FeedbackMessage message="Não foi possível atualizar suas métricas de treino." title="Métricas desatualizadas" variant="error" /><WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" /></View> : null}
    </View>
  </View>;
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.metricValue}>
    <WiseText color="accentHighlight" variant="display">{value}</WiseText>
    <WiseText color="textSecondary" variant="caption">{label}</WiseText>
  </View>;
}

function formatDayCount(value: number): string {
  return `${value} ${value === 1 ? 'dia' : 'dias'}`;
}

function formatSessionState(state: RecentStudySession['state']): string {
  switch (state) {
    case 'completed': return 'Concluída';
    case 'stopped_early': return 'Encerrada antecipadamente';
    case 'cancelled': return 'Cancelada';
    case 'discarded': return 'Descartada';
    case 'paused': return 'Pausada';
    case 'running': return 'Em andamento';
    default: return '';
  }
}

function cadenceCellLabel(day: CadenceDay): string {
  return `${formatCadenceDate(day.date)}: ${day.sessionCount} ${day.sessionCount === 1 ? 'sessão' : 'sessões'}, ${formatDuration(day.validSeconds)} válidos`;
}

function CadenceCard({ metrics }: { metrics: SessionMetrics }) {
  const days = metrics.cadence.days.slice(-56);
  const cells = Array.from({ length: 56 }, (_, index) => days[index] ?? { date: '', sessionCount: 0, validSeconds: 0, intensity: 0 as const });
  return <WiseCard accessibilityLabel="Cadência do guerreiro" role="region" testID="dashboard-cadence">
    <CardContent>
      <SectionHeading>Cadência do guerreiro</SectionHeading>
      <WiseText color="textSecondary" variant="body">Cada marca representa um dia de prática. Constância transforma esforço em domínio.</WiseText>
      <WiseText color="textSecondary" variant="caption">Período: {formatCadenceDate(metrics.cadence.windowStart)} a {formatCadenceDate(metrics.cadence.windowEnd)} · {days.filter((day) => day.sessionCount > 0).length} dias com treino</WiseText>
      <View style={styles.cadenceGrid} testID="dashboard-cadence-grid">
        {[0, 1, 2, 3].map((row) => <View key={row} style={styles.cadenceRow}>{cells.slice(row * 14, row * 14 + 14).map((day, index) => {
          const label = day.date ? cadenceCellLabel(day) : 'Dia sem dados';
          return <View
            accessible
            accessibilityLabel={label}
            accessibilityRole="image"
            aria-label={label}
            key={`${day.date || 'empty'}-${index}`}
            role="img"
            style={[styles.cadenceCell, styles[`cadenceIntensity${day.intensity}` as keyof typeof styles] as object]}
            testID={`dashboard-cadence-cell-${row * 14 + index}`}
          />;
        })}</View>)}
      </View>
      <View style={styles.legend}>
        <WiseText color="textSecondary" variant="caption">Menos foco</WiseText>
        {[0, 1, 2, 3, 4].map((intensity) => <View key={intensity} accessible={false} importantForAccessibility="no" style={[styles.legendCell, styles[`cadenceIntensity${intensity}` as keyof typeof styles] as object]} />)}
        <WiseText color="textSecondary" variant="caption">Foco profundo</WiseText>
      </View>
    </CardContent>
  </WiseCard>;
}

export function DashboardScreen() {
  const profile = useQuery(profileQueryOptions());
  const activity = useQuery(recentActivityQueryOptions());
  const metrics = useQuery(sessionMetricsQueryOptions());
  const { width } = useWindowDimensions();
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshInProgress = useRef(false);
  const refreshing = profile.isRefetching || activity.isRefetching || metrics.isRefetching;
  const statusMessage = refreshing ? 'Atualizando dados' : refreshSucceeded ? 'Dados atualizados' : null;
  const partialErrorMessage = profile.isError || activity.isError || metrics.isError ? 'Alguns dados não foram atualizados.' : null;
  const refresh = async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    setRefreshSucceeded(false);
    const request = Promise.all([profile.refetch(), activity.refetch(), metrics.refetch()])
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
    setRefreshSucceeded(!profile.isError && !activity.isError && !metrics.isError);
  }, [activity.isError, metrics.isError, profile.isError, refreshing]);

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
        <MetricsCard query={metrics} />
        {metrics.data ? <CadenceCard metrics={metrics.data} /> : null}
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sectionGap },
  metricCard: { flexBasis: 220, flexGrow: 1, minWidth: 0 },
  metricsStatus: { flexBasis: '100%' },
  metricValue: { minWidth: 0, gap: theme.space.inlineHairline },
  cadenceGrid: { gap: theme.space.inlineTight, width: '100%' },
  cadenceRow: { flexDirection: 'row', gap: theme.space.inlineTight, width: '100%' },
  cadenceCell: { aspectRatio: 1, flex: 1, minWidth: 0, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle },
  cadenceIntensity0: { backgroundColor: theme.color.surfaceInset },
  cadenceIntensity1: { backgroundColor: theme.color.accentMuted },
  cadenceIntensity2: { backgroundColor: theme.color.accentMuted, borderColor: theme.color.accentPrimary },
  cadenceIntensity3: { backgroundColor: theme.color.accentPrimary, borderColor: theme.color.accentHighlight },
  cadenceIntensity4: { backgroundColor: theme.color.accentHighlight, borderColor: theme.color.textPrimary },
  legend: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineTight },
  legendCell: { height: 12, width: 12, borderRadius: theme.radius.detail, borderWidth: theme.border.standard },
});
