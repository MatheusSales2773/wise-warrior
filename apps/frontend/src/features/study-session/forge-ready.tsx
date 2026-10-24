import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { WiseCard, theme } from '@/design-system';
import { LayeredHero } from '@/features/character/layered-hero';
import { equippedItems } from '@/features/character/catalog';
import { formatDayCount } from '@/features/dashboard/formatters';
import { profileQueryOptions, saoPauloDay, sessionHistoryQueryOptions, sessionMetricsQueryOptions } from '@/features/dashboard/queries';
import { XP_PER_FOCUS_MINUTE, estimatedXp, type FocusChoice } from './focus-choice';
import { ForgeCardTitle } from './forge-primitives';
import { styles } from './forge-styles';
import { formatRemainingTime } from './timer';

/** Hero stage scale: the 16 × 24 grid drawn at 6× on a wide Bigorna, 4× on a phone (integer scales only). */
const HERO_SCALE = { regular: 6, compact: 4 } as const;
/** The most sessions the Hoje card lists; the rest stay in the Diário. */
const TODAY_CARD_LIMIT = 5;
/** The shadow under the Herói is this many grid cells wide. */
const HERO_SHADOW_CELLS = 20;

/** The Herói over the anvil with the equipped Cosmetic Items, named below. Without a profile there is no Herói to show. */
export function ForgeReadyHero({ compact }: { compact: boolean }) {
  const { data: profile } = useQuery(profileQueryOptions());
  if (!profile) return null;
  const equipped = equippedItems(profile);
  const scale = compact ? HERO_SCALE.compact : HERO_SCALE.regular;
  return (
    <View style={styles.heroStage} testID="study-session-hero">
      <LayeredHero equipped={equipped} scale={scale} />
      <View style={[styles.heroShadow, { width: scale * HERO_SHADOW_CELLS }]} />
      {compact ? null : (
        <Text allowFontScaling style={styles.heroCaption} testID="study-session-hero-caption">
          <Text style={styles.heroCaptionName}>{profile.displayName}</Text> aguarda na bigorna
        </Text>
      )}
    </View>
  );
}

/** "1h 10min", "25min": the valid focus of the day as the summary shows it (the Diário's `formatFocusTime` writes "1h 10"). */
export function formatFocusToday(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}min`;
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}min`;
}

type SummaryCellData = { key: string; icon: 'sparkles' | 'flame' | 'time-outline'; color: string; value: string; label: string; spoken: string };

function SummaryCell({ cell, last }: { cell: SummaryCellData; last: boolean }) {
  return (
    <View accessible accessibilityLabel={cell.spoken} style={[styles.summaryCell, !last && styles.summaryCellDivided]} testID={`study-session-summary-${cell.key}`}>
      <View style={styles.summaryValueRow}>
        <Ionicons accessibilityElementsHidden color={cell.color} importantForAccessibility="no" name={cell.icon} size={14} />
        <Text allowFontScaling style={styles.summaryValue}>{cell.value}</Text>
      </View>
      <Text allowFontScaling style={styles.summaryLabel}>{cell.label}</Text>
    </View>
  );
}

/**
 * XP estimado, Constância and today's valid focus under the Herói. The XP cell comes from the chosen duration alone;
 * the other two come from the metrics and are left out when those fail, so a missing number never blocks starting.
 */
export function ForgeReadySummary({ selected }: { selected: FocusChoice }) {
  const { data: metrics } = useQuery(sessionMetricsQueryOptions());
  const xp = estimatedXp(selected);
  const xpCell: SummaryCellData = {
    key: 'xp',
    icon: 'sparkles',
    color: theme.color.accentHighlight,
    ...(xp === null
      ? { value: `${XP_PER_FOCUS_MINUTE} XP`, label: 'por minuto de foco', spoken: `${XP_PER_FOCUS_MINUTE} XP por minuto de foco` }
      : { value: `+${xp} XP`, label: 'estimado', spoken: `Estimativa: ${xp} XP` }),
  };
  const cells: SummaryCellData[] = [xpCell];
  if (metrics) {
    cells.push(
      { key: 'constancy', icon: 'flame', color: theme.color.feedbackEnergy, value: formatDayCount(metrics.currentStreakDays), label: 'constância', spoken: `Constância: ${formatDayCount(metrics.currentStreakDays)}` },
      { key: 'focus-today', icon: 'time-outline', color: theme.color.feedbackInfo, value: formatFocusToday(metrics.validSecondsToday), label: 'foco hoje', spoken: `Foco válido hoje: ${formatFocusToday(metrics.validSecondsToday)}` },
    );
  }
  return (
    <View accessibilityLabel="Resumo da sessão" role="group" style={styles.summary} testID="study-session-summary">
      {cells.map((cell, index) => <SummaryCell cell={cell} key={cell.key} last={index === cells.length - 1} />)}
    </View>
  );
}

/** An icon and one line of copy: the rules, and the sessions of the day. */
function NoteRow({ icon, color, children }: { icon: 'checkmark' | 'time-outline' | 'flame'; color: string; children: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons accessibilityElementsHidden color={color} importantForAccessibility="no" name={icon} size={16} />
      <Text allowFontScaling style={styles.ruleText}>{children}</Text>
    </View>
  );
}

export function ForgeRulesCard() {
  return (
    <WiseCard style={styles.sideCard} testID="study-session-rules">
      <ForgeCardTitle>Regras da forja</ForgeCardTitle>
      <NoteRow color={theme.color.feedbackSuccess} icon="checkmark">XP e foco válido são confirmados ao concluir.</NoteRow>
      <NoteRow color={theme.color.textSecondary} icon="time-outline">Encerrar antes de 5 minutos não concede XP.</NoteRow>
      <NoteRow color={theme.color.feedbackEnergy} icon="flame">Terminar uma sessão por dia mantém sua constância.</NoteRow>
    </WiseCard>
  );
}

/** The sessions that ended today. Loading and failure leave the card out; the Forja never waits on it. */
export function ForgeTodayCard() {
  const history = useInfiniteQuery(sessionHistoryQueryOptions({ date: saoPauloDay() }));
  if (!history.data) return null;
  const items = history.data.pages.flatMap((page) => page.items).slice(0, TODAY_CARD_LIMIT);
  return (
    <WiseCard style={styles.sideCard} testID="study-session-today-card">
      <ForgeCardTitle>Hoje</ForgeCardTitle>
      {items.length === 0 ? <Text allowFontScaling style={styles.ruleText}>Nenhuma sessão encerrada hoje.</Text> : null}
      {items.map((item) => {
        // A clock marks a session that did not conclude in full (stopped early, cancelled, discarded).
        const counted = item.state === 'completed';
        return (
          <NoteRow color={counted ? theme.color.feedbackSuccess : theme.color.textSecondary} icon={counted ? 'checkmark' : 'time-outline'} key={item.id}>
            {`${item.subject?.trim() || 'Sem matéria'} · ${formatRemainingTime(item.durationValidSeconds)} · +${item.xpAwarded} XP`}
          </NoteRow>
        );
      })}
    </WiseCard>
  );
}
