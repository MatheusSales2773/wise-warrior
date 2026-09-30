import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseCard, WiseText, isDesktopLayout, theme, type WiseCardProps } from '@/design-system';
import { formatCadenceDate, formatDiscardReason, formatDuration, formatSessionDate, formatXp } from './formatters';
import type { CadenceDay, RecentStudySession, SessionMetrics } from './api';
import { profileQueryOptions, recentActivityQueryOptions, sessionMetricsQueryOptions } from './queries';

function SectionHeading({ children }: PropsWithChildren) {
  return <View style={styles.cardTitleLabel}>
    <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.cardTitleText}>◈</Text>
    <Text accessibilityRole="header" aria-level={2} style={styles.cardTitleText}>{children}</Text>
  </View>;
}

function CardTitle({ children, ornament }: PropsWithChildren<{ ornament?: string }>) {
  return <View style={styles.cardTitle}>
    <SectionHeading>{children}</SectionHeading>
    {ornament ? <Text style={styles.ornament}>{ornament}</Text> : null}
  </View>;
}

function StatLabel({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" aria-level={2} style={styles.statLabel}>{children}</Text>;
}

/** Gold corner brackets from the prototype's framed cards. Purely decorative. */
function CardCorners() {
  return <>
    {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => <View
      accessibilityElementsHidden
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      key={corner}
      pointerEvents="none"
      style={[styles.corner, styles[`corner_${corner}`]]}
    >
      <View style={[styles.cornerTickH, corner.endsWith('r') ? { right: -1 } : { left: -1 }, corner.startsWith('t') ? { top: -1 } : { bottom: -1 }]} />
      <View style={[styles.cornerTickV, corner.endsWith('r') ? { right: -1 } : { left: -1 }, corner.startsWith('t') ? { top: -1 } : { bottom: -1 }]} />
    </View>)}
  </>;
}

function FramedCard({ children, style, ...props }: PropsWithChildren<Omit<WiseCardProps, 'variant'>>) {
  return <WiseCard {...props} style={[styles.framedCard, style]}>
    <CardCorners />
    {children}
  </WiseCard>;
}

function DashboardGlow({ hero = false }: { hero?: boolean }) {
  return <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
    <Defs>
      <RadialGradient id={hero ? 'dashboardHeroGlow' : 'dashboardPageGlow'} cx={hero ? '85%' : '50%'} cy={hero ? '50%' : '0%'} r={hero ? '55%' : '80%'}>
        <Stop offset="0" stopColor={hero ? theme.color.accentPrimary : theme.color.backgroundRaised} stopOpacity={hero ? '0.35' : '1'} />
        <Stop offset="1" stopColor={hero ? theme.color.accentPrimary : theme.color.backgroundCanvas} stopOpacity={hero ? '0' : '0'} />
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#${hero ? 'dashboardHeroGlow' : 'dashboardPageGlow'})`} />
  </Svg>;
}

function GuildSigil({ size = 40 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 100 100" fill="none">
    <Path d="M50 6 L86 22 V52 C86 70 70 86 50 94 C30 86 14 70 14 52 V22 Z" stroke={theme.color.accentPrimary} strokeWidth={1.5} fill="rgba(212,168,90,0.04)" />
    <Path d="M50 28 V64 M44 60 L50 66 L56 60 M44 36 H56" stroke={theme.color.accentPrimary} strokeWidth={2} strokeLinecap="round" />
  </Svg>;
}

function FlameGlyph({ size = 15 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c.5 3.5 4.5 5.5 4.5 10a4.5 4.5 0 1 1-9 0c0-2.3 1.2-3.6 2.2-4.8.3 1.6 1.1 2.6 2.3 3.1C11.4 8.8 11 6 12 3Z" stroke={theme.color.backgroundCanvas} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>;
}

function ChevronGlyph({ size = 12 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 5l7 7-7 7" stroke={theme.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
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
      <View style={styles.activityMain}>
        <Text allowFontScaling style={styles.activitySubject}>{display.subject ?? display.status}{display.mode === 'guild' ? ' · guilda' : ''}</Text>
        <Text style={styles.activityMeta}>{display.date} · {display.duration}</Text>
      </View>
      {display.discarded
        ? <Text style={styles.activityDiscarded}>{display.discarded}</Text>
        : <Text style={styles.activityXp}>+{display.xp}</Text>}
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
      <FramedCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-loading">
        <CardContent>
          <CardTitle>Atividade recente</CardTitle>
          <Text style={styles.emptyState}>Carregando sessões recentes…</Text>
        </CardContent>
      </FramedCard>
    );
  }

  if (query.isError && !query.data) {
    return (
      <FramedCard accessibilityLabel="Atividade recente" role="region" testID="dashboard-activity-error">
        <CardContent>
          <CardTitle>Atividade recente</CardTitle>
          <FeedbackMessage message="Não foi possível carregar suas sessões recentes." title="Atividade indisponível" variant="error" />
          <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" />
        </CardContent>
      </FramedCard>
    );
  }

  const sessions = query.data ?? [];
  return (
    <FramedCard accessibilityLabel="Atividade recente" role="region" testID={sessions.length ? 'dashboard-activity' : 'dashboard-activity-empty'}>
      <CardContent>
        <CardTitle>Atividade recente</CardTitle>
        {sessions.length
          ? sessions.slice(0, 5).map((session) => <ActivityItem key={session.id} session={session} />)
          : <Text style={styles.emptyState}>Nenhuma sessão encerrada ainda. Suas sessões encerradas aparecerão aqui.</Text>}
        {query.isRefetching ? <WiseText color="textSecondary" testID="dashboard-activity-refreshing" variant="caption">Atualizando atividade…</WiseText> : null}
        {query.isError ? (
          <View style={styles.activityRefreshError} testID="dashboard-activity-refresh-error">
            <FeedbackMessage message="Não foi possível atualizar suas sessões concluídas." title="Atividade desatualizada" variant="error" />
            <WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" />
          </View>
        ) : null}
      </CardContent>
    </FramedCard>
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
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-loading"><CardContent><CardTitle>Ritmo de treino</CardTitle><WiseText variant="body">Carregando suas métricas…</WiseText></CardContent></WiseCard>;
  }
  if (query.isError && !query.data) {
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-error"><CardContent><CardTitle>Ritmo de treino</CardTitle><FeedbackMessage message="Não foi possível carregar suas métricas de treino." title="Métricas indisponíveis" variant="error" /><WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" /></CardContent></WiseCard>;
  }

  const metrics = query.data;
  if (!metrics) return null;
  const goal = Math.max(0, metrics.dailyGoal);
  return <View style={styles.metricsGrid} testID="dashboard-metrics">
    <WiseCard accessibilityLabel={`Streak: ${metrics.currentStreakDays} dias; recorde pessoal de ${metrics.longestStreakDays} dias`} role="region" style={styles.metricCard} testID="dashboard-streak">
      <View style={styles.metricContent}>
        <StatLabel>Sequência atual</StatLabel>
        <Text style={styles.metricBig}>{formatDayCount(metrics.currentStreakDays)}</Text>
        <Text style={styles.metricTrend}>Recorde pessoal: {formatDayCount(metrics.longestStreakDays)}</Text>
      </View>
    </WiseCard>
    <WiseCard accessibilityLabel={`Sessões hoje: ${metrics.sessionsToday}${goal ? ` de ${goal}` : ''}; ${formatDuration(metrics.validSecondsToday)} de foco válido`} role="region" style={styles.metricCard} testID="dashboard-sessions">
      <View style={styles.metricContent}>
        <StatLabel>Sessões hoje</StatLabel>
        <Text style={styles.metricBig}>{metrics.sessionsToday}{goal ? ` / ${goal}` : ''}</Text>
        <Text style={styles.metricTrend}>{formatDuration(metrics.validSecondsToday)} de foco válido</Text>
      </View>
    </WiseCard>
    <View style={styles.metricsStatus}>
      {query.isRefetching ? <WiseText color="textSecondary" testID="dashboard-metrics-refreshing" variant="caption">Atualizando métricas…</WiseText> : null}
      {query.isError ? <View testID="dashboard-metrics-refresh-error"><FeedbackMessage message="Não foi possível atualizar suas métricas de treino." title="Métricas desatualizadas" variant="error" /><WiseButton label="Tentar novamente" loading={query.isRefetching} onPress={() => void retry()} variant="secondary" /></View> : null}
    </View>
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

const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];

function CadenceCard({ metrics }: { metrics: SessionMetrics }) {
  const days = metrics.cadence.days.slice(-56);
  const cells = Array.from({ length: 56 }, (_, index) => days[index] ?? { date: '', sessionCount: 0, validSeconds: 0, intensity: 0 as const });
  const trainedDays = days.filter((day) => day.sessionCount > 0).length;
  // GitHub-style grid: one column per week, rows aligned to the real weekday (Sunday first).
  const leadingBlanks = cells[0]?.date ? new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() : 0;
  return <FramedCard accessibilityLabel="Cadência do guerreiro" role="region" testID="dashboard-cadence">
    <CardContent>
      <CardTitle ornament={formatDayCount(trainedDays)}>Cadência do guerreiro</CardTitle>
      <Text style={styles.cardDescription}>Cada marca representa um dia de prática. Constância transforma esforço em domínio.</Text>
      <Text style={styles.cadencePeriod}>Período: {formatCadenceDate(metrics.cadence.windowStart)} a {formatCadenceDate(metrics.cadence.windowEnd)}</Text>
      <View style={styles.cadenceGrid} testID="dashboard-cadence-grid">
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cadenceWeekdays}>
          {WEEKDAY_LABELS.map((label, row) => <Text key={row} style={styles.cadenceWeekday}>{label}</Text>)}
        </View>
        {Array.from({ length: Math.ceil((leadingBlanks + cells.length) / 7) }, (_, week) => <View key={week} style={styles.cadenceWeek}>
          {Array.from({ length: 7 }, (_, weekday) => {
            const index = week * 7 + weekday - leadingBlanks;
            const day = cells[index];
            if (!day) return <View key={weekday} style={styles.cadenceBlank} />;
            const label = day.date ? cadenceCellLabel(day) : 'Dia sem dados';
            return <View
              accessible
              accessibilityLabel={label}
              accessibilityRole="image"
              aria-label={label}
              key={`${day.date || 'empty'}-${index}`}
              role="img"
              style={[styles.cadenceCell, styles[`cadenceIntensity${day.intensity}` as keyof typeof styles] as object]}
              testID={`dashboard-cadence-cell-${index}`}
            />;
          })}
        </View>)}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Menos foco</Text>
        <View style={styles.legendCells}>
          {[0, 1, 2, 3, 4].map((intensity) => <View key={intensity} accessible={false} importantForAccessibility="no" style={[styles.legendCell, styles[`cadenceIntensity${intensity}` as keyof typeof styles] as object]} />)}
        </View>
        <Text style={styles.legendText}>Foco profundo</Text>
      </View>
    </CardContent>
  </FramedCard>;
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
  const compact = width < 640;
  const xpPercent = Math.min(100, Math.round(((user.xpTotal - user.levelStartXp) / Math.max(1, user.nextLevelXp - user.levelStartXp)) * 100));
  return <Screen backgroundOverlay={<DashboardGlow />} safeAreaEdges={[]} title="Acampamento" testID="dashboard" {...refreshProps}>
    {partialErrorMessage ? <View accessibilityLiveRegion="none" aria-live="off" style={styles.partialError} testID="dashboard-partial-error"><WiseText color="feedbackDanger" variant="caption">{partialErrorMessage}</WiseText></View> : null}
    <View testID="dashboard-grid" style={[styles.grid, desktop && styles.desktopGrid]}>
      <View testID="dashboard-main-column" style={styles.mainColumn}>
        <View accessibilityLabel="Resumo de perfil" role="region" style={styles.heroCard} testID="dashboard-profile">
          <LinearGradient colors={[theme.color.surfaceCard, theme.color.backgroundOverlay]} end={{ x: 1, y: 0.6 }} pointerEvents="none" start={{ x: 0, y: 0.4 }} style={StyleSheet.absoluteFill} />
          <DashboardGlow hero />
          <View style={[styles.heroContent, compact && styles.heroContentCompact]} testID="dashboard-profile-content">
            <View style={styles.heroCopy}>
              <View style={styles.heroGreetingRow}>
                <Text aria-hidden style={styles.heroGreeting}>✦</Text>
                <Text accessibilityRole="header" aria-level={2} style={styles.heroGreeting}>Boas-vindas, {user.displayName}</Text>
              </View>
              <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{user.title || 'Sua jornada começa aqui'}</Text>
              <View testID="dashboard-status" accessibilityLiveRegion="polite" aria-live="polite" aria-atomic style={styles.status}>{statusMessage ? <Text style={[styles.statusText, { color: refreshing ? theme.color.accentPrimary : theme.color.feedbackSuccess }]}>{statusMessage}</Text> : null}</View>
            </View>
            <WiseButton label="Atualizar dados" loading={refreshing} onPress={() => void refresh()} variant="ghost" />
          </View>
        </View>
        <ProfileRefreshError query={profile} />
        <FramedCard accessibilityLabel="Progressão" role="region" testID="dashboard-progression">
          <CardContent>
            <CardTitle ornament={`Nível ${user.level}`}>Progressão</CardTitle>
            <View style={styles.progressionTotals}>
              <Text style={styles.progressionXp}>{formatXp(user.xpTotal)} XP total</Text>
              <Text style={styles.progressionPercent}>{xpPercent}%</Text>
            </View>
            <ProgressBar accessibilityLabel={`Progresso para o nível ${user.level + 1}`} maximumValue={user.nextLevelXp} minimumValue={user.levelStartXp} size="tall" testID="dashboard-progress" value={user.xpTotal} />
            <Text style={styles.progressionRemaining}>{formatXp(user.xpTotal - user.levelStartXp)} XP no nível · faltam {formatXp(user.nextLevelXp - user.xpTotal)} XP</Text>
          </CardContent>
        </FramedCard>
        <MetricsCard query={metrics} />
        {metrics.data ? <CadenceCard metrics={metrics.data} /> : null}
      </View>
      <View style={[styles.sideColumn, desktop && styles.desktopSideColumn]} testID="dashboard-side-column">
        <ActivityCard query={activity} />
        <FramedCard accessibilityLabel="Guilda" role="region" testID="dashboard-guild-preview">
          <View style={styles.guildHeader}>
            <LinearGradient colors={[theme.color.backgroundOverlay, 'transparent']} pointerEvents="none" style={StyleSheet.absoluteFill} />
            <GuildSigil />
            <View style={styles.guildHeaderCopy}>
              <Text style={styles.guildEyebrow}>Guilda</Text>
              <Text accessibilityRole="header" aria-level={2} style={styles.guildName}>Sua guilda</Text>
            </View>
          </View>
          <View style={styles.guildBody}>
            <Text style={styles.cardDescription}>Sua guilda está em preparação. Em breve vocês enfrentarão raids juntos.</Text>
            <Link asChild href="/guilda">
              <Pressable accessibilityRole="link" accessibilityLabel="Entrar na Guilda">
                <View style={styles.guildAction}>
                  <Text style={styles.guildActionText}>Entrar na Guilda</Text>
                  <ChevronGlyph />
                </View>
              </Pressable>
            </Link>
          </View>
        </FramedCard>
        <Link asChild href="/sessao">
          <Pressable accessibilityRole="link" accessibilityLabel="Iniciar foco" style={styles.focusAction}>
            <LinearGradient colors={[theme.color.accentPrimary, theme.color.accentMuted]} end={{ x: 0, y: 1 }} start={{ x: 0, y: 0 }} style={styles.focusGradient}>
              <FlameGlyph />
              <Text style={styles.focusText}>Iniciar foco</Text>
            </LinearGradient>
          </Pressable>
        </Link>
      </View>
    </View>
  </Screen>;
}

const display = { fontFamily: 'Cinzel-SemiBold' } as const;
const mono = { fontFamily: 'JetBrainsMono-Medium' } as const;
const cornerSize = 14;
const cadenceCellSize = 13;
const cadenceGap = 3;

const styles = StyleSheet.create({
  loading: { gap: theme.space.stackDefault, padding: theme.space.cardInset },
  errorContent: { gap: theme.space.stackDefault },
  inlineError: { gap: theme.space.stackDefault },
  partialError: { marginBottom: theme.space.stackTight },

  grid: { width: '100%', flexDirection: 'column', gap: 22 },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0, gap: 18 },
  sideColumn: { minWidth: 0, gap: 18 },
  desktopSideColumn: { width: 320, flexShrink: 0 },

  framedCard: { borderRadius: theme.radius.control, overflow: 'visible', borderColor: theme.color.borderSoft, borderWidth: theme.border.standard },
  corner: { position: 'absolute', width: cornerSize, height: cornerSize, borderColor: theme.color.borderEmphasis },
  corner_tl: { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 },
  corner_tr: { top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 },
  corner_bl: { bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 },
  corner_br: { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 },
  cornerTickH: { position: 'absolute', width: 5, height: 1, backgroundColor: theme.color.accentPrimary },
  cornerTickV: { position: 'absolute', width: 1, height: 5, backgroundColor: theme.color.accentPrimary },

  cardContent: { minWidth: 0, padding: 22 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.stackTight, marginBottom: 16 },
  cardTitleLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  cardTitleText: { ...display, fontSize: 11, lineHeight: 16, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  ornament: { ...mono, fontSize: 10, letterSpacing: 2, color: theme.color.accentMuted },
  cardDescription: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 19, color: theme.color.textSecondary },
  emptyState: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 19, color: theme.color.textTertiary, paddingVertical: theme.space.inlineTight },

  heroCard: { position: 'relative', overflow: 'hidden', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, paddingVertical: 28, paddingHorizontal: 32 },
  heroContentCompact: { padding: 22, gap: theme.space.controlInset },
  heroCopy: { minWidth: 0, flexShrink: 1, flexGrow: 1, maxWidth: 540 },
  heroGreetingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineHairline },
  heroGreeting: { ...display, fontSize: 9, lineHeight: 14, letterSpacing: 2.9, textTransform: 'uppercase', color: theme.color.accentPrimary },
  heroTitle: { ...display, fontSize: 26, lineHeight: 34, letterSpacing: 1, color: theme.color.textPrimary, marginTop: 6, marginBottom: 4 },
  heroTitleCompact: { fontSize: 22, lineHeight: 30 },
  status: { minHeight: 16 },
  statusText: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, letterSpacing: 0.9 },

  progressionTotals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight, marginBottom: theme.space.inlineTight },
  progressionXp: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.textSecondary },
  progressionPercent: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.accentHighlight },
  progressionRemaining: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, letterSpacing: 0.4, color: theme.color.textTertiary, marginTop: theme.space.inlineTight },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  metricCard: { flexBasis: 240, flexGrow: 1, minWidth: 0, borderRadius: theme.radius.control },
  metricContent: { padding: 22, gap: theme.space.inlineHairline },
  statLabel: { fontFamily: 'Inter-Medium', fontSize: 10, lineHeight: 14, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.color.textTertiary },
  metricBig: { fontFamily: 'Cinzel-Bold', fontSize: 28, lineHeight: 32, letterSpacing: 1.1, color: theme.color.textPrimary, marginVertical: theme.space.inlineHairline },
  metricTrend: { ...mono, fontSize: 11, lineHeight: 16, color: theme.color.textSecondary },
  metricsStatus: { flexBasis: '100%' },

  cadencePeriod: { ...mono, fontSize: 10, lineHeight: 14, letterSpacing: 1, color: theme.color.textTertiary, marginTop: theme.space.inlineHairline, marginBottom: 14 },
  cadenceGrid: { flexDirection: 'row', gap: cadenceGap, alignSelf: 'flex-start', maxWidth: '100%' },
  cadenceWeekdays: { gap: cadenceGap, marginRight: theme.space.inlineHairline },
  cadenceWeekday: { fontFamily: 'Inter-Regular', fontSize: 9, lineHeight: cadenceCellSize, height: cadenceCellSize, color: theme.color.textTertiary },
  cadenceWeek: { gap: cadenceGap },
  cadenceBlank: { width: cadenceCellSize, height: cadenceCellSize },
  cadenceCell: { width: cadenceCellSize, height: cadenceCellSize, borderRadius: 2, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost },
  cadenceIntensity0: { backgroundColor: theme.color.surfaceInset },
  cadenceIntensity1: { backgroundColor: 'rgba(212, 168, 90, 0.15)' },
  cadenceIntensity2: { backgroundColor: 'rgba(212, 168, 90, 0.3)' },
  cadenceIntensity3: { backgroundColor: 'rgba(212, 168, 90, 0.55)' },
  cadenceIntensity4: { backgroundColor: theme.color.accentPrimary, shadowColor: theme.color.accentPrimary, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  legend: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: theme.space.inlineTight, marginTop: theme.space.stackTight },
  legendCells: { flexDirection: 'row', gap: cadenceGap },
  legendText: { fontFamily: 'Inter-Regular', fontSize: 10, lineHeight: 14, letterSpacing: 1, color: theme.color.textTertiary },
  legendCell: { height: cadenceCellSize, width: cadenceCellSize, borderRadius: 2, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost },

  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, minWidth: 0, paddingVertical: 10, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost, borderStyle: 'dashed' },
  activityMain: { flex: 1, minWidth: 0, gap: 3 },
  activitySubject: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 17, color: theme.color.textPrimary },
  activityMeta: { fontFamily: 'Inter-Regular', fontSize: 10, lineHeight: 14, letterSpacing: 0.6, color: theme.color.textTertiary },
  activityXp: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 12, lineHeight: 17, color: theme.color.accentHighlight, flexShrink: 0 },
  activityDiscarded: { ...mono, fontSize: 11, lineHeight: 16, color: theme.color.feedbackDanger, flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  activityRefreshError: { gap: theme.space.stackDefault, marginTop: theme.space.stackTight },

  guildHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: 18, paddingHorizontal: 22, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost, overflow: 'hidden', borderTopLeftRadius: theme.radius.control, borderTopRightRadius: theme.radius.control },
  guildHeaderCopy: { flexShrink: 1, gap: 2 },
  guildEyebrow: { fontFamily: 'Inter-SemiBold', fontSize: 9, lineHeight: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  guildName: { ...display, fontSize: 13, lineHeight: 18, letterSpacing: 0.8, color: theme.color.textPrimary },
  guildBody: { padding: 22, gap: 16 },
  guildAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight, paddingHorizontal: 14, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.detail },
  guildActionText: { ...display, fontSize: 10, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase', color: theme.color.textPrimary },

  focusAction: { minHeight: theme.layout.touchTarget, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.accentHighlight, overflow: 'hidden', shadowColor: theme.color.accentPrimary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  focusGradient: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight, paddingHorizontal: 22 },
  focusText: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 16, letterSpacing: 2.2, textTransform: 'uppercase', color: theme.color.backgroundCanvas },
});
