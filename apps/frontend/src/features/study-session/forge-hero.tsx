import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { theme } from '@/design-system';
import { LayeredHero } from '@/features/character/layered-hero';
import { equippedItems } from '@/features/character/catalog';
import { formatDayCount } from '@/features/dashboard/formatters';
import { profileQueryOptions, sessionMetricsQueryOptions } from '@/features/dashboard/queries';
import { styles } from './forge-styles';
import { formatFocusToday } from './xp';

const SPARKS = [
  { left: 4, top: 22, size: 4 },
  { left: 40, top: 0, size: 3 },
  { left: 92, top: 14, size: 4 },
  { left: 100, top: 52, size: 3 },
  { left: -6, top: 62, size: 3 },
];

/**
 * The Herói at the Bigorna: what they wear, sparks while the clock runs, and a caption that names them. Without the
 * profile the Herói keeps the base look and the caption speaks of "Seu Herói".
 */
export function ForgeHero({ paused, guild, subject, compact, doing }: {
  paused: boolean;
  guild: boolean;
  subject: string | null;
  compact: boolean;
  /** What the Herói is doing, when it is not the clock's own: "forjou 25 minutos" on a result. */
  doing?: string;
}) {
  const { data: profile } = useQuery(profileQueryOptions());
  const name = profile?.displayName ?? 'Seu Herói';
  const action = doing ?? (paused ? 'descansa a marreta' : guild ? 'está forjando para a Raid' : 'está forjando');
  return (
    <View style={styles.hero} testID="study-session-hero">
      <View style={[styles.heroStage, compact && styles.heroStageCompact]}>
        {paused ? null : SPARKS.map((spark, index) => (
          <View
            key={index}
            style={[styles.heroSpark, { left: spark.left, top: spark.top, width: spark.size, height: spark.size }]}
            testID="study-session-spark"
          />
        ))}
        <LayeredHero equipped={equippedItems(profile ?? { equipped: [] })} scale={compact ? 4 : 5} />
      </View>
      <Text allowFontScaling style={styles.heroCaption} testID="study-session-hero-caption">
        {`${name} ${action}${subject ? ` · ${subject}` : ''}`}
      </Text>
    </View>
  );
}

function Stat({ icon, color, value, label, testID }: { icon: 'sparkles' | 'flame' | 'time-outline'; color: string; value: string; label: string; testID: string }) {
  return (
    <View style={styles.summaryStat} testID={testID}>
      <View style={styles.summaryValueRow}>
        <Ionicons accessibilityElementsHidden importantForAccessibility="no" name={icon} size={14} color={color} />
        <Text allowFontScaling style={styles.summaryValue}>{value}</Text>
      </View>
      <Text allowFontScaling style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

/** Desktop summary under the Hero: the XP of the session, the Constância and the focus of today. A cell whose data failed is left out. */
export function ForgeSummary({ xp, free, xpLabel }: { xp: number; free: boolean; xpLabel?: string }) {
  const { data: metrics } = useQuery(sessionMetricsQueryOptions());
  return (
    <View style={styles.summary} testID="study-session-summary">
      <Stat icon="sparkles" color={theme.color.accentHighlight} value={`+${xp} XP`} label={xpLabel ?? (free ? 'até agora' : 'ao concluir')} testID="study-session-summary-xp" />
      {metrics ? <Stat icon="flame" color={theme.color.feedbackEnergy} value={formatDayCount(metrics.currentStreakDays)} label="constância" testID="study-session-summary-streak" /> : null}
      {metrics ? <Stat icon="time-outline" color={theme.color.feedbackInfo} value={formatFocusToday(metrics.validSecondsToday)} label="foco hoje" testID="study-session-summary-today" /> : null}
    </View>
  );
}

type StripCell = { value: string; label: string; testID: string };

/** Compact summary: three cells side by side, a value over its label. */
export function ForgeStrip({ cells }: { cells: StripCell[] }) {
  return (
    <View style={styles.strip} testID="study-session-strip">
      {cells.map((cell, index) => (
        <View key={cell.label} style={[styles.stripCell, index > 0 && styles.stripCellDivided]} testID={cell.testID}>
          <Text allowFontScaling numberOfLines={1} style={styles.stripValue}>{cell.value}</Text>
          <Text allowFontScaling style={styles.summaryLabel}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The running session in three columns, Matéria · planned or kind · XP. */
export function ForgeSessionStrip({ subject, planned, free, xp }: { subject: string; planned: string; free: boolean; xp: number }) {
  return (
    <ForgeStrip
      cells={[
        { value: subject, label: 'matéria', testID: 'study-session-strip-subject' },
        { value: planned, label: free ? 'tipo' : 'planejado', testID: 'study-session-strip-planned' },
        { value: `+${xp} XP`, label: free ? 'até agora' : 'ao concluir', testID: 'study-session-strip-xp' },
      ]}
    />
  );
}
