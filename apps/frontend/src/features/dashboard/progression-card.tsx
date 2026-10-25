import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar, theme } from '@/design-system';
import { CardContent, CardTitle, FramedCard, mono } from './card-chrome';
import { formatXp, levelProgressPercent } from './formatters';

export type ProgressionCardProps = {
  level: number;
  xpTotal: number;
  levelStartXp: number;
  nextLevelXp: number;
};

export function ProgressionCard({ level, xpTotal, levelStartXp, nextLevelXp }: ProgressionCardProps) {
  const xpPercent = levelProgressPercent({ xpTotal, levelStartXp, nextLevelXp });
  return <FramedCard accessibilityLabel="Progressão" role="region" testID="dashboard-progression">
    <CardContent>
      <CardTitle ornament={`Nível ${level}`}>Progressão</CardTitle>
      <View style={styles.progressionTotals}>
        <Text style={styles.progressionXp}>{formatXp(xpTotal)} XP total</Text>
        <Text style={styles.progressionPercent}>{xpPercent}%</Text>
      </View>
      <ProgressBar accessibilityLabel={`Progresso para o nível ${level + 1}`} maximumValue={nextLevelXp} minimumValue={levelStartXp} size="tall" testID="dashboard-progress" value={xpTotal} />
      <Text style={styles.progressionRemaining}>{formatXp(xpTotal - levelStartXp)} XP no nível · faltam {formatXp(nextLevelXp - xpTotal)} XP</Text>
    </CardContent>
  </FramedCard>;
}

const styles = StyleSheet.create({
  progressionTotals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.inlineTight, marginBottom: theme.space.inlineTight },
  progressionXp: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.textSecondary },
  progressionPercent: { ...mono, fontSize: 12, lineHeight: 18, color: theme.color.accentHighlight },
  progressionRemaining: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, letterSpacing: 0.4, color: theme.color.textTertiary, marginTop: theme.space.inlineTight },
});
