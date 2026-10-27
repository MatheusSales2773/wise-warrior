import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar, WiseText, theme } from '@/design-system';
import type { WeekSummary } from '@/features/dashboard/api';
import { formatXp } from '@/features/dashboard/formatters';
import { weekSummaryQueryOptions } from '@/features/dashboard/queries';
import { weekRangeLabel } from './diary';
import { formatFocusTime, subjectShare, weekBars } from './week';

/** The side column of the Diário: "Esta semana" and "Matérias da semana", both over the São Paulo week. */
export function WeekCards({ desktop }: { desktop: boolean }) {
  const week = useQuery(weekSummaryQueryOptions());
  if (week.isPending) return <WiseText color="textSecondary" testID="week-loading" variant="body">Carregando a semana…</WiseText>;
  if (!week.data) {
    return <Card testID="week-error" title="Esta semana">
      <WiseText color="textSecondary" variant="body">Não foi possível carregar a semana.</WiseText>
    </Card>;
  }
  return <View style={[styles.column, desktop && styles.columnDesktop]} testID="week-cards">
    <ThisWeek week={week.data} />
    <Subjects week={week.data} />
  </View>;
}

function ThisWeek({ week }: { week: WeekSummary }) {
  const bars = weekBars(week);
  return <Card range={weekRangeLabel(week.weekStart)} testID="week-card" title="Esta semana">
    <View style={styles.totals}>
      <Total label="foco válido" testID="week-focus" value={formatFocusTime(week.validSeconds)} />
      <Total label="sessões" testID="week-sessions" value={String(week.sessionCount)} />
      <Total label="XP" testID="week-xp" value={formatXp(week.xp)} />
    </View>
    <View accessibilityLabel="Foco válido por dia da semana" role="img" style={styles.chart} testID="week-chart">
      {bars.map((bar) => <View accessibilityLabel={bar.label} key={bar.date} style={styles.barColumn} testID={`week-bar-${bar.date}`}>
        <View style={[styles.bar, bar.today && styles.barToday, { height: bar.height }]} testID={bar.today ? 'week-bar-today' : undefined} />
        <Text style={[styles.initial, bar.today && styles.initialToday]}>{bar.initial}</Text>
      </View>)}
    </View>
  </Card>;
}

function Subjects({ week }: { week: WeekSummary }) {
  const top = week.subjects[0]?.validSeconds ?? 0;
  return <Card testID="week-subjects" title="Matérias da semana">
    {week.subjects.length === 0
      ? <WiseText color="textSecondary" testID="week-subjects-empty" variant="body">Nenhuma sessão nesta semana ainda.</WiseText>
      : week.subjects.map(({ subject, validSeconds }) => <View key={subject} style={styles.subject} testID={`week-subject-${subject}`}>
        <View style={styles.subjectLine}>
          <Text numberOfLines={1} style={styles.subjectName}>{subject}</Text>
          <Text style={styles.subjectTime}>{formatFocusTime(validSeconds)}</Text>
        </View>
        <ProgressBar accessibilityLabel={`${subject}: ${formatFocusTime(validSeconds)}`} size="hairline" value={subjectShare(validSeconds, top)} />
      </View>)}
  </Card>;
}

function Total({ label, testID, value }: { label: string; testID: string; value: string }) {
  return <View style={styles.total}>
    <Text style={styles.totalValue} testID={testID}>{value}</Text>
    <Text style={styles.totalLabel}>{label}</Text>
  </View>;
}

function Card({ children, range, testID, title }: { children: React.ReactNode; range?: string; testID: string; title: string }) {
  return <View accessibilityLabel={title} role="region" style={styles.card} testID={testID}>
    <View style={styles.cardHeader}>
      <View style={styles.titleRow}>
        <Text aria-hidden style={styles.cardTitle}>◈</Text>
        <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{title}</Text>
      </View>
      {range ? <Text style={styles.range} testID="week-range">{range}</Text> : null}
    </View>
    {children}
  </View>;
}

const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  column: { gap: 16 },
  columnDesktop: { width: 368 },
  card: { gap: 14, padding: 22, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 14, letterSpacing: 2.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  range: { fontFamily: mono, fontSize: 10, lineHeight: 14, letterSpacing: 1, color: theme.color.textTertiary },
  totals: { flexDirection: 'row' },
  total: { flex: 1, gap: 2 },
  totalValue: { fontFamily: 'Cinzel-Bold', fontSize: 20, lineHeight: 26, color: theme.color.textPrimary },
  totalLabel: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 14, color: theme.color.textSecondary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: 24, maxWidth: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: theme.color.accentPrimary, opacity: 0.55 },
  barToday: { backgroundColor: theme.color.accentHighlight, opacity: 1 },
  initial: { fontFamily: mono, fontSize: 10, lineHeight: 14, color: theme.color.textTertiary },
  initialToday: { color: theme.color.accentHighlight },
  subject: { gap: 6 },
  subjectLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subjectName: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 13, lineHeight: 18, color: theme.color.textPrimary },
  subjectTime: { fontFamily: mono, fontSize: 11, lineHeight: 14, color: theme.color.textSecondary },
});
