import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProgressBar, theme } from '@/design-system';
import type { WeekSummary } from './api';
import { CardContent, CardTitle, FramedCard, mono } from './card-chrome';
import { formatFocusMinutes, formatXp, levelProgressPercent, topWeekSubjects } from './formatters';

export type ProgressionCardProps = {
  level: number;
  xpTotal: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** The week's subjects, most valid focus first. Undefined while the summary is unavailable; the row hides then. */
  weekSubjects?: WeekSummary['subjects'] | undefined;
  /** Mobile scrolls the subject chips sideways; desktop wraps them. */
  desktop?: boolean;
};

export function ProgressionCard({ level, xpTotal, levelStartXp, nextLevelXp, weekSubjects, desktop = false }: ProgressionCardProps) {
  const xpPercent = levelProgressPercent({ xpTotal, levelStartXp, nextLevelXp });
  const subjects = topWeekSubjects(weekSubjects);
  const chips = subjects.map(({ subject, validSeconds }) => <View key={subject} style={styles.chip} testID="dashboard-week-subject">
    <Text style={styles.chipSubject}>{subject}</Text>
    <Text style={styles.chipTime}>{formatFocusMinutes(Math.floor(validSeconds / 60))}</Text>
  </View>);
  return <FramedCard accessibilityLabel="Progressão" role="region" testID="dashboard-progression">
    <CardContent>
      <CardTitle ornament={`Nível ${level}`}>Progressão</CardTitle>
      <View style={styles.progressionTotals}>
        <Text style={styles.progressionXp}>{formatXp(xpTotal)} XP total</Text>
        <Text style={styles.progressionPercent}>{xpPercent}%</Text>
      </View>
      <ProgressBar accessibilityLabel={`Progresso para o nível ${level + 1}`} maximumValue={nextLevelXp} minimumValue={levelStartXp} size="tall" testID="dashboard-progress" value={xpTotal} />
      <Text style={styles.progressionRemaining}>{formatXp(xpTotal - levelStartXp)} XP no nível · faltam {formatXp(nextLevelXp - xpTotal)} XP</Text>
      {subjects.length > 0 ? <View accessibilityLabel="Matérias da semana" role="group" style={styles.subjectsRow} testID="dashboard-week-subjects">
        <Text style={styles.subjectsLabel}>{desktop ? 'Esta semana' : 'Semana'}</Text>
        {desktop
          ? <View style={styles.chipsWrap}>{chips}</View>
          : <ScrollView contentContainerStyle={styles.chipsScroll} horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScrollView} testID="dashboard-week-subjects-scroll">{chips}</ScrollView>}
      </View> : null}
    </CardContent>
  </FramedCard>;
}

const styles = StyleSheet.create({
  progressionTotals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight, marginBottom: theme.space.inlineTight },
  progressionXp: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.textSecondary },
  progressionPercent: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.accentHighlight },
  progressionRemaining: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, letterSpacing: 0.4, color: theme.color.textTertiary, marginTop: theme.space.inlineTight },
  subjectsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  subjectsLabel: { fontFamily: 'Inter-Medium', fontSize: 10, lineHeight: 14, letterSpacing: 1.8, textTransform: 'uppercase', color: theme.color.textTertiary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 },
  chipsScrollView: { flex: 1 },
  chipsScroll: { gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  chipSubject: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, color: theme.color.textSecondary },
  chipTime: { ...mono, fontSize: 11, lineHeight: 16, color: theme.color.accentHighlight },
});
