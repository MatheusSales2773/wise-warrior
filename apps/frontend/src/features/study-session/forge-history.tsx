import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackMessage, WiseButton, WiseCard, WiseText, theme } from '@/design-system';
import type { CadenceDay, SessionHistoryItem } from '@/features/dashboard/api';
import { formatCappedReason, formatDuration } from '@/features/dashboard/formatters';
import { sessionHistoryQueryOptions, sessionMetricsQueryOptions, saoPauloDay } from '@/features/dashboard/queries';


/** Focuses in a Pomodoro cycle, as `/sessions/cycle` reports in `cycleLength` (D-027). */
const FOCUS_CYCLE_LENGTH = 4;
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

export function historyOutcome(item: SessionHistoryItem): string {
  if (item.state === 'discarded') return 'Não contabilizada pelo antifraude';
  if (item.cappedReason) return formatCappedReason(item.cappedReason);
  switch (item.state) {
    case 'completed': return item.cyclePosition ? `Foco ${item.cyclePosition} de ${FOCUS_CYCLE_LENGTH}` : 'Foco concluído';
    case 'stopped_early': return 'Encerrada antes do fim';
    case 'cancelled': return 'Cancelada';
    default: return 'Encerrada';
  }
}

export function historyItemLabel(item: SessionHistoryItem): string {
  const subject = item.subject?.trim() || 'Sem matéria';
  const span = `${TIME.format(new Date(item.startedAt))} às ${TIME.format(new Date(item.endedAt))}`;
  return `${subject}. ${span}. ${formatDuration(item.durationValidSeconds)} de foco válido. ${historyOutcome(item)}. ${item.xpAwarded} XP.`;
}

function HistoryItem({ item }: { item: SessionHistoryItem }) {
  const subject = item.subject?.trim() || 'Sem matéria';
  const counted = item.state !== 'discarded';
  return (
    <View accessible accessibilityLabel={historyItemLabel(item)} style={styles.item} testID={`forge-history-item-${item.id}`}>
      <View style={styles.itemMain}>
        <WiseText variant="label">{subject}</WiseText>
        <WiseText color="textSecondary" variant="body">
          {TIME.format(new Date(item.startedAt))}–{TIME.format(new Date(item.endedAt))} · {formatDuration(item.durationValidSeconds)}
        </WiseText>
        <WiseText color={counted ? 'textSecondary' : 'feedbackDanger'} testID={`forge-history-outcome-${item.id}`} variant="caption">{historyOutcome(item)}</WiseText>
      </View>
      <WiseText color={item.xpAwarded > 0 ? 'accentPrimary' : 'textSecondary'} variant="label">{item.xpAwarded > 0 ? `+${item.xpAwarded} XP` : '0 XP'}</WiseText>
    </View>
  );
}

function TodayHistory() {
  const history = useInfiniteQuery(sessionHistoryQueryOptions(saoPauloDay()));
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  const body = (() => {
    if (history.isPending) return <WiseText color="textSecondary" testID="forge-history-loading" variant="body">Carregando as sessões de hoje…</WiseText>;
    if (history.isError && !history.data) {
      return <View style={styles.stack} testID="forge-history-error">
        <FeedbackMessage message="Não foi possível carregar o histórico de hoje." title="Histórico indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={history.isRefetching} onPress={() => void history.refetch()} variant="secondary" />
      </View>;
    }
    if (!items.length) return <WiseText color="textSecondary" testID="forge-history-empty" variant="body">Nenhuma sessão encerrada hoje. As sessões que você concluir aparecem aqui.</WiseText>;
    return <>
      {history.isError ? <FeedbackMessage message="Não foi possível atualizar o histórico." testID="forge-history-stale" title="Dados desatualizados" variant="error" /> : null}
      {items.map((item) => <HistoryItem item={item} key={item.id} />)}
      {history.isFetchNextPageError ? <FeedbackMessage message="Não foi possível carregar mais sessões." title="Lista incompleta" variant="error" /> : null}
      {history.hasNextPage
        ? <WiseButton label="Carregar mais" loading={history.isFetchingNextPage} onPress={() => void history.fetchNextPage()} testID="forge-history-more" variant="ghost" />
        : null}
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Histórico de hoje" role="region" style={styles.card} testID="forge-history">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Hoje</WiseText>
        {body}
      </View>
    </WiseCard>
  );
}

const CHART_HEIGHT = 96;

function minutes(day: CadenceDay): number {
  return Math.floor(day.validSeconds / 60);
}

export function weeklySummary(days: CadenceDay[]): string {
  const total = days.reduce((sum, day) => sum + minutes(day), 0);
  const active = days.filter((day) => day.validSeconds > 0).length;
  return `Últimos 7 dias: ${total} min de foco válido em ${active} ${active === 1 ? 'dia' : 'dias'}.`;
}

/** Seven bars of valid focus per day. One series, so no legend; today and the best day carry a direct label. */
function WeeklyFocusChart() {
  const metrics = useQuery(sessionMetricsQueryOptions());
  const days = metrics.data?.cadence.days.slice(-7) ?? [];

  const body = (() => {
    if (metrics.isPending) return <WiseText color="textSecondary" testID="forge-week-loading" variant="body">Carregando a semana…</WiseText>;
    if (metrics.isError && !metrics.data) {
      return <View style={styles.stack} testID="forge-week-error">
        <FeedbackMessage message="Não foi possível carregar a semana." title="Semana indisponível" variant="error" />
        <WiseButton label="Tentar novamente" loading={metrics.isRefetching} onPress={() => void metrics.refetch()} variant="secondary" />
      </View>;
    }
    const today = days[days.length - 1]?.date;
    const max = Math.max(1, ...days.map(minutes));
    const best = days.reduce<CadenceDay | null>((top, day) => (day.validSeconds > 0 && (!top || day.validSeconds > top.validSeconds) ? day : top), null);
    return <>
      <WiseText color="textSecondary" testID="forge-week-summary" variant="body">{weeklySummary(days)}</WiseText>
      <View accessibilityRole="list" style={styles.chart} testID="forge-week-chart">
        {days.map((day) => {
          const value = minutes(day);
          const isToday = day.date === today;
          const label = `${isToday ? 'Hoje' : WEEKDAY.format(new Date(`${day.date}T00:00:00Z`))}, ${DAY_MONTH.format(new Date(`${day.date}T00:00:00Z`))}: ${value} min`;
          return (
            <View accessible accessibilityLabel={label} key={day.date} style={styles.column} testID={`forge-week-day-${day.date}`}>
              <Text allowFontScaling style={styles.value}>{isToday || day === best ? `${value}` : ' '}</Text>
              <View style={styles.track}>
                <View style={[styles.bar, { height: value > 0 ? Math.max(4, Math.round((value / max) * CHART_HEIGHT)) : 2 }, value === 0 && styles.barEmpty]} />
              </View>
              <Text allowFontScaling style={[styles.weekday, isToday && styles.weekdayToday]}>
                {isToday ? 'Hoje' : WEEKDAY.format(new Date(`${day.date}T00:00:00Z`)).replace('.', '')}
              </Text>
            </View>
          );
        })}
      </View>
    </>;
  })();

  return (
    <WiseCard accessibilityLabel="Foco válido na semana" role="region" style={styles.card} testID="forge-week">
      <View style={styles.cardContent}>
        <WiseText accessibilityRole="header" aria-level={2} variant="subtitle">Foco na semana (min)</WiseText>
        {body}
      </View>
    </WiseCard>
  );
}

/** Histórico do dia and the week, below the Forja (#17). Both refresh when XP lands on any device. */
export function ForgeHistory({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.section, wide && styles.sectionWide]} testID="forge-history-section">
      <TodayHistory />
      <WeeklyFocusChart />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space.stackDefault },
  sectionWide: { flexDirection: 'row', alignItems: 'flex-start' },
  card: { flex: 1 },
  cardContent: { padding: theme.space.cardInset, gap: theme.space.stackTight },
  stack: { gap: theme.space.stackDefault },
  item: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: theme.space.inlineTight, borderTopWidth: theme.border.standard, borderTopColor: theme.color.borderSubtle },
  itemMain: { flex: 1, gap: theme.space.inlineHairline },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: theme.space.inlineTight },
  column: { flex: 1, alignItems: 'center', gap: theme.space.inlineHairline },
  value: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: theme.color.textSecondary },
  track: { height: CHART_HEIGHT, width: '100%', justifyContent: 'flex-end', borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderSubtle },
  // Rounded data end on top, square on the baseline.
  bar: { width: '70%', alignSelf: 'center', backgroundColor: theme.color.accentPrimary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barEmpty: { backgroundColor: theme.color.borderSubtle },
  weekday: { fontFamily: 'Inter-Medium', fontSize: 12, color: theme.color.textSecondary, textTransform: 'capitalize' },
  weekdayToday: { fontFamily: 'Inter-SemiBold', color: theme.color.textPrimary },
});
