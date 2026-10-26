import { Link } from 'expo-router';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ProgressBar, WiseButton, WiseIcon, theme } from '@/design-system';
import { cosmeticSprite } from '@/features/character/catalog';
import { PixelSprite } from '@/features/character/PixelSprite';
import { itemSprites } from '@/features/character/sprites';
import { CoinMark } from '@/features/market/coin';
import type { ActiveRaid } from './api';
import { formatRewardCoins, formatRewardName } from './messages';
import { WEEK_DAY_STATE_LABEL, bossLifePercent, formatBattleTimeLeft, formatFocusHours, raidWeekGrid, type WeekDay } from './raid-battle';
import { useRaidTimeLeft } from './use-raid-clock';

/* Pieces shared by the Raid battle screen and the Raid card of the Guilda screen (Figma 06b and 06c). */

const REWARD_RULE_CAPTION = 'Para todos que contribuírem';

export function TimePill({ compact, raid, testID = 'raid-time-left' }: { compact: boolean; raid: ActiveRaid; testID?: string }) {
  const left = useRaidTimeLeft(raid);
  return <View style={[styles.glass, styles.timePill, compact && styles.timePillCompact]}>
    <WiseIcon color="textPrimary" name="time-outline" size="xsmall" />
    <Text style={[styles.timeText, compact && styles.timeTextCompact]} testID={testID}>{formatBattleTimeLeft(left, { long: !compact })}</Text>
  </View>;
}

/** The goal grows by what the Fúria gave back, so "foco coletivo" is what the Meta batida really takes. */
export function bossLifeView(raid: ActiveRaid): { percent: number; label: string; needed: string } {
  const percent = bossLifePercent(raid.healthXp, raid.goalXp, raid.goalReachedAt !== null);
  const needed = formatFocusHours(raid.goalXp + raid.regeneratedXp);
  return { percent, label: `Vida do Boss: ${percent}%. ${formatFocusHours(raid.progressXp)} de ${needed} de foco coletivo.`, needed };
}

function LifeBar({ percent, label }: { percent: number; label: string }) {
  return <ProgressBar accessibilityLabel={label} maximumValue={100} size="slim" testID="raid-boss-life" tone="danger" value={percent} />;
}

/** Desktop: painel sobre a cena, no canto superior direito. */
export function BossLifePanel({ raid }: { raid: ActiveRaid }) {
  const { percent, label, needed } = bossLifeView(raid);
  return <View style={[styles.glass, styles.lifePanel]}>
    <View style={styles.spread}>
      <Text style={styles.lifeTitle}>Vida do Boss</Text>
      <Text style={styles.lifePercent} testID="raid-boss-life-percent">{percent}%</Text>
    </View>
    <LifeBar label={label} percent={percent} />
    <Text style={styles.lifeCaption} testID="raid-focus-hours">{formatFocusHours(raid.progressXp)} de {needed} de foco coletivo</Text>
  </View>;
}

/** Celular: linha sob a cena. */
export function BossLifeRow({ raid }: { raid: ActiveRaid }) {
  const { percent, label, needed } = bossLifeView(raid);
  return <View style={styles.lifeRow}>
    <View style={styles.spread}>
      <Text style={styles.lifeTitle}>Vida do Boss</Text>
      <Text style={styles.lifeMeta} testID="raid-boss-life-percent">{percent}% · {formatFocusHours(raid.progressXp)}/{needed}</Text>
    </View>
    <LifeBar label={label} percent={percent} />
  </View>;
}

type DayLook = {
  label: string;
  glyph: string;
  cell?: 'weekDayStudied' | 'weekDayToday';
  initial?: 'weekDayInitialToday';
  glyphStyle?: 'weekDayMarkStudied' | 'weekDayMarkToday';
};

/** One entry per day state: spoken label, glyph and the style keys that draw it (Figma 06b, card "Fúria do dragão"). */
const DAY_LOOKS: Record<WeekDay['state'], DayLook> = {
  studied: { label: WEEK_DAY_STATE_LABEL.studied, glyph: '✓', cell: 'weekDayStudied', glyphStyle: 'weekDayMarkStudied' },
  today: { label: WEEK_DAY_STATE_LABEL.today, glyph: '•', cell: 'weekDayToday', initial: 'weekDayInitialToday', glyphStyle: 'weekDayMarkToday' },
  missed: { label: WEEK_DAY_STATE_LABEL.missed, glyph: '·' },
  upcoming: { label: WEEK_DAY_STATE_LABEL.upcoming, glyph: '·' },
};

export function WeekGrid({ raid }: { raid: ActiveRaid }) {
  return <View style={styles.weekGrid} testID="raid-week-grid">
    {raidWeekGrid(raid).map((day) => {
      const look = DAY_LOOKS[day.state];
      return <View
        accessible
        accessibilityLabel={`${day.name}: ${look.label}`}
        key={day.key}
        style={[styles.weekDay, look.cell && styles[look.cell]]}
        testID={`raid-week-day-${day.state}`}
      >
        <Text style={[styles.weekDayInitial, look.initial && styles[look.initial]]}>{day.initial}</Text>
        <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={[styles.weekDayMark, look.glyphStyle && styles[look.glyphStyle]]}>{look.glyph}</Text>
      </View>;
    })}
  </View>;
}

/** What the Raid gives, for the screen readers: every item, then the Moedas. */
function rewardsLabel(raid: ActiveRaid): string {
  return [...raid.rewards.map(formatRewardName), formatRewardCoins(raid.coins)].join(', ');
}

export function AttackButton({ raid, testID = 'raid-attack' }: { raid: ActiveRaid; testID?: string }) {
  const timeLeft = useRaidTimeLeft(raid);
  const over = raid.status !== 'active' || timeLeft <= 0;
  return <Link asChild href="/sessao?modo=guilda">
    <WiseButton
      accessibilityLabel={`Atacar com foco: abrir a Forja com uma sessão de guilda para a Raid ${raid.mission.name}`}
      disabled={over}
      label="Atacar com foco"
      leading={<WiseIcon color={over ? 'textSecondary' : 'backgroundCanvas'} name="play" size="xsmall" />}
      testID={testID}
    />
  </Link>;
}

/** The reward list as a vertical card body: every item, the Moedas and the rule caption. */
export function RewardList({ raid }: { raid: ActiveRaid }) {
  return <View accessible accessibilityLabel={`${rewardsLabel(raid)}. ${REWARD_RULE_CAPTION}.`} style={styles.rewardList} testID="raid-reward">
    {raid.rewards.map((reward) => <View key={reward.itemId} style={styles.reward} testID={`raid-reward-${reward.itemId}`}>
      <View style={styles.rewardIcon}><PixelSprite scale={4} sprite={itemSprites[cosmeticSprite(reward)]} /></View>
      <Text style={styles.rewardName}>{formatRewardName(reward)}</Text>
    </View>)}
    <View style={styles.reward}>
      <View style={styles.rewardIcon}><CoinMark scale={4} /></View>
      <Text style={styles.rewardName} testID="raid-reward-coins">{formatRewardCoins(raid.coins)}</Text>
    </View>
    <Text style={styles.rewardCaption}>{REWARD_RULE_CAPTION}</Text>
  </View>;
}

export function JoinRaidButton({ label = 'Participar', loading, onPress, testID }: { label?: string; loading: boolean; onPress: () => void; testID: string }) {
  return <WiseButton label={label} loading={loading} onPress={onPress} testID={testID} />;
}

export function RewardChips({ raid }: { raid: ActiveRaid }) {
  return <View accessible accessibilityLabel={`Ao derrotar: ${rewardsLabel(raid)}. ${REWARD_RULE_CAPTION}.`} style={styles.chips} testID="raid-reward">
    <Text style={styles.chipsLabel}>AO DERROTAR</Text>
    {raid.rewards.map((reward) => <View key={reward.itemId} style={styles.chip}>
      <PixelSprite scale={3} sprite={itemSprites[cosmeticSprite(reward)]} />
      <Text numberOfLines={1} style={styles.chipText}>{reward.name}</Text>
    </View>)}
    <View style={styles.chip}>
      <CoinMark scale={3} />
      <Text numberOfLines={1} style={styles.chipText} testID="raid-reward-coins">+{raid.coins}</Text>
    </View>
  </View>;
}

const mono = 'JetBrainsMono-Medium';
const glassBackground = 'rgba(7, 7, 12, 0.72)';
// The Figma panels blur the scene behind them. React Native Web supports it; native keeps the translucent fill.
const webGlassBlur = (Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}) as ViewStyle;

const styles = StyleSheet.create({
  glass: { borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: glassBackground, ...webGlassBlur },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill },
  timePillCompact: { gap: 6, paddingHorizontal: 9, paddingVertical: 4 },
  timeText: { fontFamily: mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.4, color: theme.color.textPrimary },
  timeTextCompact: { fontSize: 10, lineHeight: 13 },
  lifePanel: { gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.radius.card },
  lifeRow: { gap: 8 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.space.inlineTight },
  lifeTitle: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  lifePercent: { fontFamily: mono, fontSize: 13, lineHeight: 17, color: theme.color.feedbackDanger },
  lifeMeta: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.feedbackDanger },
  lifeCaption: { fontFamily: mono, fontSize: 10, lineHeight: 13, color: theme.color.textSecondary },
  weekGrid: { flexDirection: 'row', gap: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderGhost, backgroundColor: theme.color.surfaceInset },
  weekDayStudied: { borderColor: theme.color.feedbackSuccess, backgroundColor: theme.color.surfaceElevated },
  weekDayToday: { borderColor: theme.color.accentPrimary },
  weekDayInitial: { fontFamily: mono, fontSize: 10, color: theme.color.textTertiary },
  weekDayInitialToday: { color: theme.color.accentHighlight },
  weekDayMark: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.color.textTertiary },
  weekDayMarkStudied: { color: theme.color.feedbackSuccess },
  weekDayMarkToday: { color: theme.color.accentHighlight },
  rewardList: { gap: 10 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardIcon: { padding: 6, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  rewardName: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, color: theme.color.textPrimary },
  rewardCaption: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 13, color: theme.color.textTertiary },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chipsLabel: { fontFamily: mono, fontSize: 9, lineHeight: 12, letterSpacing: 1, color: theme.color.textTertiary },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 5, paddingRight: 9, paddingVertical: 3, maxWidth: '100%',
    borderRadius: theme.radius.pill, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard,
  },
  chipText: { flexShrink: 1, fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 15, color: theme.color.textPrimary },
});
