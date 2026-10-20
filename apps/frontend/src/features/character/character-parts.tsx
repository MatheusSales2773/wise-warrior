import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ProgressBar, WiseIcon, theme, type SemanticColor, type WiseIconName } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import type { SessionMetrics, UserProfile } from '@/features/dashboard/api';
import { formatXp } from '@/features/dashboard/formatters';
import type { HeroDefinition, HeroStatus } from './catalog';
import { formatCompactXp, formatDeviceSummary } from './formatters';

/* Pieces shared by the desktop and mobile Personagem layouts. `compact` is the mobile sizing from the Figma v2 frames. */

export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return { focusProps: { onBlur: () => setFocused(false), onFocus: () => setFocused(true) }, focusStyle: focused && Platform.OS === 'web' ? controlStyles.webFocus : null };
}

export function SectionHeader({ aside, children }: PropsWithChildren<{ aside?: ReactNode }>) {
  return <View style={styles.sectionHeader}>
    <View style={styles.sectionTitle}>
      <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.sectionTitleText}>◈</Text>
      <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitleText, styles.sectionTitleLabel]}>{children}</Text>
    </View>
    {aside}
  </View>;
}

/** Shown under the title while the equipment drawer previews an item. */
export function PreviewMark() {
  return <Text style={styles.previewMark} testID="character-preview">Prévia · nada foi salvo</Text>;
}

/* ---------- Dispositivos ---------- */

export type DevicesState = { count: number | null; failed: boolean };

export function describeDevices({ count, failed }: DevicesState, compact: boolean): string {
  if (count !== null) return formatDeviceSummary(count, Platform.OS === 'web' ? 'Este navegador' : 'Este dispositivo', compact);
  return failed ? 'Não foi possível carregar seus dispositivos' : 'Carregando dispositivos…';
}

/* ---------- Progressão de nível ---------- */

export function LevelProgress({ compact = false, user }: { compact?: boolean; user: UserProfile }) {
  const levelSpan = Math.max(1, user.nextLevelXp - user.levelStartXp);
  const xpInLevel = Math.max(0, user.xpTotal - user.levelStartXp);
  const remaining = Math.max(0, user.nextLevelXp - user.xpTotal);

  return <View style={[styles.progression, compact && styles.progressionCompact]}>
    <ProgressBar accessibilityLabel={`Progresso para o nível ${user.level + 1}`} maximumValue={levelSpan} minimumValue={0} size="slim" testID="character-progress" value={Math.min(xpInLevel, levelSpan)} />
    <View style={styles.progressionLabels}>
      <Text style={styles.progressionCurrent}>{formatXp(xpInLevel)} / {formatXp(levelSpan)} XP</Text>
      <Text style={styles.progressionNext}>Nível {user.level + 1} em {formatXp(remaining)} XP</Text>
    </View>
  </View>;
}

/* ---------- Resumo ---------- */

function Stat({ color, compact, icon, label, value }: { color: SemanticColor; compact: boolean; icon: WiseIconName; label: string; value: string }) {
  return <View accessible accessibilityLabel={`${value} ${label}`} style={[styles.stat, compact && styles.statCompact]}>
    <View style={styles.statValueRow}>
      <WiseIcon color={color} name={icon} size="xsmall" />
      <Text style={[styles.statValue, compact && styles.statValueCompact]}>{value}</Text>
    </View>
    <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>{label}</Text>
  </View>;
}

export function SummaryRow({ compact = false, metrics, user }: { compact?: boolean; metrics: SessionMetrics | undefined; user: UserProfile }) {
  const goal = metrics ? Math.max(0, metrics.dailyGoal) : 0;
  return <View accessibilityLabel="Resumo" role="region" style={styles.summary} testID="character-summary">
    <Stat color="feedbackEnergy" compact={compact} icon="flame" label={metrics?.currentStreakDays === 1 ? 'dia seguido' : 'dias seguidos'} value={metrics ? String(metrics.currentStreakDays) : '—'} />
    <View style={styles.statDivider} />
    <Stat color="accentPrimary" compact={compact} icon="hammer-outline" label="sessões hoje" value={metrics ? `${metrics.sessionsToday}${goal ? `/${goal}` : ''}` : '—'} />
    <View style={styles.statDivider} />
    <Stat color="accentHighlight" compact={compact} icon="sparkles" label="XP total" value={formatCompactXp(user.xpTotal)} />
  </View>;
}

/* ---------- Pílula de status do herói ---------- */

const pillByStatus = {
  equipped: { label: () => 'EQUIPADO', container: 'pillEquipped', text: 'pillTextEquipped' },
  unlocked: { label: () => 'EQUIPAR', container: 'pillUnlocked', text: 'pillTextUnlocked' },
  'level-locked': { label: (hero: HeroDefinition) => `NÍVEL ${hero.unlock.kind === 'level' ? hero.unlock.level : ''}`, container: 'pillLocked', text: 'pillTextLocked' },
  'premium-locked': { label: () => '✦ PREMIUM', container: 'pillPremium', text: 'pillTextPremium' },
} as const satisfies Record<HeroStatus, { label: (hero: HeroDefinition) => string; container: keyof typeof styles; text: keyof typeof styles }>;

export function HeroPill({ compact = false, hero, status }: { compact?: boolean; hero: HeroDefinition; status: HeroStatus }) {
  const pill = pillByStatus[status];
  return <View style={[styles.pill, compact && styles.pillCompact, styles[pill.container]]}>
    <Text style={[styles.pillText, compact && styles.pillTextCompact, styles[pill.text]]}>{pill.label(hero)}</Text>
  </View>;
}

const cinzel = 'Cinzel-Bold';
const mono = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: theme.space.inlineTight },
  sectionTitleText: { fontFamily: cinzel, fontSize: 11, lineHeight: 15, color: theme.color.accentPrimary },
  sectionTitleLabel: { letterSpacing: 2.6, textTransform: 'uppercase' },

  previewMark: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: 'uppercase', color: theme.color.accentHighlight },

  progression: { alignSelf: 'stretch', paddingTop: theme.space.inlineTight, gap: 6 },
  progressionCompact: { paddingTop: 6 },
  progressionLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.inlineTight },
  progressionCurrent: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.textSecondary },
  progressionNext: { fontFamily: mono, fontSize: 11, lineHeight: 15, color: theme.color.textTertiary },

  summary: { width: '100%', flexDirection: 'row', overflow: 'hidden', borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: theme.space.inlineHairline, paddingVertical: 16 },
  statCompact: { paddingVertical: 14 },
  statDivider: { width: theme.border.standard, backgroundColor: theme.color.borderGhost },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: cinzel, fontSize: 20, lineHeight: 27, color: theme.color.textPrimary },
  statValueCompact: { fontSize: 18, lineHeight: 24 },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 15, color: theme.color.textSecondary },
  statLabelCompact: { fontSize: 11, lineHeight: 13 },

  pill: { paddingHorizontal: 10, paddingVertical: theme.space.inlineHairline, borderRadius: theme.radius.pill, borderWidth: theme.border.standard, backgroundColor: theme.color.surfaceInset },
  pillCompact: { paddingHorizontal: 8, paddingVertical: 3 },
  pillEquipped: { borderColor: theme.color.accentPrimary },
  pillUnlocked: { borderColor: theme.color.borderEmphasis },
  pillLocked: { borderColor: theme.color.borderGhost },
  pillPremium: { borderColor: theme.color.accentMuted },
  pillText: { fontFamily: mono, fontSize: 10, lineHeight: 13, letterSpacing: 1 },
  pillTextCompact: { fontSize: 9, lineHeight: 12 },
  pillTextEquipped: { color: theme.color.accentHighlight },
  pillTextUnlocked: { color: theme.color.textPrimary },
  pillTextLocked: { color: theme.color.textTertiary },
  pillTextPremium: { color: theme.color.accentPrimary },
});
