import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import { CardContent, CardTitle, cardText, mono } from './card-chrome';
import type { SessionsObjective, WeeklyMinutesObjective } from '@/features/chronicles/queries';
import { formatDayCount, formatFocusSeconds, formatSessionsToday, formatWeeklyFocusLine } from './formatters';
import type { SessionMetrics } from './api';

const DEFAULT_SESSION_MARKERS = 4;

function StatLabel({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" aria-level={2} style={cardText.eyebrow}>{children}</Text>;
}

function ConstancyCard({ currentDays, longestDays }: { currentDays: number; longestDays: number }) {
  return <WiseCard accessibilityLabel={`Constância: ${formatDayCount(currentDays)}; recorde de ${formatDayCount(longestDays)}`} role="region" style={styles.metricCard} testID="dashboard-constancy">
    <View style={styles.metricContent}>
      <StatLabel>Constância</StatLabel>
      <Text style={styles.metricBig}>{formatDayCount(currentDays)}</Text>
      <Text style={styles.metricTrend}>Recorde: {formatDayCount(longestDays)}</Text>
    </View>
  </WiseCard>;
}

/** Markers follow the Objetivo: one per session of its target, filled by its progress. Without it, four markers filled by the day's count. */
function SessionsTodayCard({ sessionsToday, objective }: { sessionsToday: number; objective: SessionsObjective | undefined }) {
  const { value, spoken } = formatSessionsToday(sessionsToday, objective);
  const done = objective?.progress ?? sessionsToday;
  return <WiseCard accessibilityLabel={`Sessões hoje: ${spoken}`} role="region" style={styles.metricCard} testID="dashboard-sessions">
    <View style={styles.metricContent}>
      <StatLabel>Sessões hoje</StatLabel>
      <Text style={styles.metricBig}>{value}</Text>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.markers} testID="dashboard-sessions-markers">
        {Array.from({ length: objective?.target ?? DEFAULT_SESSION_MARKERS }, (_, index) => <View
          key={index}
          style={[styles.marker, index < done && styles.markerFilled]}
          testID={`dashboard-sessions-marker-${index}`}
        />)}
      </View>
    </View>
  </WiseCard>;
}

function FocusTodayCard({ validSecondsToday, weeklyObjective }: { validSecondsToday: number; weeklyObjective: WeeklyMinutesObjective | undefined }) {
  const focus = formatFocusSeconds(validSecondsToday);
  const support = formatWeeklyFocusLine(weeklyObjective, validSecondsToday);
  return <WiseCard accessibilityLabel={`Foco válido hoje: ${focus}; ${support}`} role="region" style={styles.metricCard} testID="dashboard-focus">
    <View style={styles.metricContent}>
      <StatLabel>Foco válido hoje</StatLabel>
      <Text style={styles.metricBig}>{focus}</Text>
      <Text style={styles.metricTrend} testID="dashboard-focus-support">{support}</Text>
    </View>
  </WiseCard>;
}

export type MetricsCardProps = {
  metrics: SessionMetrics | undefined;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  /** Progress and target of the "Conclua 4 sessões hoje" Objetivo, when it has loaded. */
  sessionsObjective: SessionsObjective | undefined;
  /** Progress and target of the weekly minutes Objetivo, when it has loaded. */
  weeklyObjective?: WeeklyMinutesObjective | undefined;
  onRetry: () => void;
};

/** The Constância, sessions-today and valid-focus cards, with their own loading, error and background-refresh states. */
export function MetricsCard({ metrics, isPending, isError, isRefetching, sessionsObjective, weeklyObjective, onRetry }: MetricsCardProps) {
  if (isPending && !metrics) {
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-loading"><CardContent><CardTitle>Ritmo de treino</CardTitle><WiseText variant="body">Carregando suas métricas…</WiseText></CardContent></WiseCard>;
  }
  if (isError && !metrics) {
    return <WiseCard accessibilityLabel="Métricas de sessões" role="region" testID="dashboard-metrics-error"><CardContent><CardTitle>Ritmo de treino</CardTitle><FeedbackMessage message="Não foi possível carregar suas métricas de treino." title="Métricas indisponíveis" variant="error" /><WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" /></CardContent></WiseCard>;
  }

  if (!metrics) return null;
  return <View style={styles.metricsGrid} testID="dashboard-metrics">
    <ConstancyCard currentDays={metrics.currentStreakDays} longestDays={metrics.longestStreakDays} />
    <SessionsTodayCard objective={sessionsObjective} sessionsToday={metrics.sessionsToday} />
    <FocusTodayCard validSecondsToday={metrics.validSecondsToday} weeklyObjective={weeklyObjective} />
    {isRefetching || isError ? <View style={styles.metricsStatus} testID="dashboard-metrics-status">
      {isRefetching ? <WiseText color="textSecondary" testID="dashboard-metrics-refreshing" variant="caption">Atualizando métricas…</WiseText> : null}
      {isError ? <View testID="dashboard-metrics-refresh-error"><FeedbackMessage message="Não foi possível atualizar suas métricas de treino." title="Métricas desatualizadas" variant="error" /><WiseButton label="Tentar novamente" loading={isRefetching} onPress={onRetry} variant="secondary" /></View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  metricCard: { flexBasis: 200, flexGrow: 1, minWidth: 0, borderRadius: theme.radius.control },
  metricContent: { padding: 22, gap: theme.space.inlineHairline },
  metricBig: { fontFamily: 'Cinzel-Bold', fontSize: 28, lineHeight: 32, letterSpacing: 1.1, color: theme.color.textPrimary, marginVertical: theme.space.inlineHairline },
  metricTrend: { ...mono, fontSize: 11, lineHeight: 16, color: theme.color.textSecondary },
  markers: { flexDirection: 'row', gap: 6, minHeight: 16, alignItems: 'center' },
  marker: { width: 28, height: 6, borderRadius: 2, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  markerFilled: { backgroundColor: theme.color.accentPrimary },
  metricsStatus: { flexBasis: '100%' },
});
