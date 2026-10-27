import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/design-system';
import { CardContent, CardTitle, FramedCard, cardText, mono } from './card-chrome';
import { formatCadenceDate, formatDayCount, formatDuration } from './formatters';
import type { CadenceDay, SessionMetrics } from './api';

const cadenceCellSize = 13;
const cadenceGap = 3;
const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];

function cadenceCellLabel(day: CadenceDay): string {
  return `${formatCadenceDate(day.date)}: ${day.sessionCount} ${day.sessionCount === 1 ? 'sessão' : 'sessões'}, ${formatDuration(day.validSeconds)} válidos`;
}

export function CadenceCard({ cadence }: { cadence: SessionMetrics['cadence'] }) {
  const days = cadence.days.slice(-56);
  const cells = Array.from({ length: 56 }, (_, index) => days[index] ?? { date: '', sessionCount: 0, validSeconds: 0, intensity: 0 as const });
  const trainedDays = days.filter((day) => day.sessionCount > 0).length;
  // GitHub-style grid: one column per week, rows aligned to the real weekday (Sunday first).
  const leadingBlanks = cells[0]?.date ? new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() : 0;
  return <FramedCard accessibilityLabel="Cadência do guerreiro" role="region" testID="dashboard-cadence">
    <CardContent>
      <CardTitle ornament={formatDayCount(trainedDays)}>Cadência do guerreiro</CardTitle>
      <Text style={cardText.cardDescription}>Cada marca representa um dia de prática. Constância transforma esforço em domínio.</Text>
      <Text style={styles.cadencePeriod}>Período: {formatCadenceDate(cadence.windowStart)} a {formatCadenceDate(cadence.windowEnd)}</Text>
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

const styles = StyleSheet.create({
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
});
