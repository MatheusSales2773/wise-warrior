import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { theme } from '@/design-system';
import { controlStyles } from '@/design-system/components/control-styles';
import { useSessionsObjective } from '@/features/chronicles/queries';
import { formatSessionsToday } from '@/features/dashboard/formatters';
import { sessionMetricsQueryOptions } from '@/features/dashboard/queries';
import { formatElapsedTime, formatRemainingTime } from './timer';
import { styles } from './forge-styles';

/** The pill draws at most this many bars, however high the daily Objetivo goes. */
const TODAY_BARS_LIMIT = 8;

export function ForgePageGradient() {
  return (
    <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} testID="study-session-page-gradient" width="100%" height="100%">
      <Defs>
        <RadialGradient id="forgePageGlow" cx="50%" cy="0%" r="90%">
          <Stop offset="0" stopColor={theme.color.backgroundOverlay} />
          <Stop offset="0.5" stopColor={theme.color.backgroundRaised} />
          <Stop offset="1" stopColor={theme.color.backgroundCanvas} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#forgePageGlow)" />
    </Svg>
  );
}

export function ForgeStageGradient() {
  return (
    <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} testID="study-session-stage-gradient" width="100%" height="100%">
      <Defs>
        <RadialGradient id="forgeStageGlow" cx="50%" cy="45%" r="65%">
          <Stop offset="0" stopColor={theme.color.accentPrimary} stopOpacity="0.26" />
          <Stop offset="0.55" stopColor={theme.color.accentPrimary} stopOpacity="0.07" />
          <Stop offset="1" stopColor={theme.color.accentPrimary} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#forgeStageGlow)" />
    </Svg>
  );
}

/** Small gold "◈ TÍTULO" heading used by the prototype's side cards. */
export function ForgeCardTitle({ children }: { children: string }) {
  return (
    <View style={styles.cardTitle}>
      <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.cardTitleText}>◈</Text>
      <Text accessibilityRole="header" allowFontScaling style={styles.cardTitleText}>{children}</Text>
    </View>
  );
}

export function ForgeAction({ label, icon, onPress, primary = false, disabled = false, loading = false, testID, iconOnly = false, expanded, fullWidth = false }: {
  label: string;
  icon: 'stop' | 'pause' | 'play' | 'settings-outline';
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  iconOnly?: boolean;
  expanded?: boolean;
  fullWidth?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const content = <>
    <Ionicons accessibilityElementsHidden importantForAccessibility="no" name={icon} size={16} color={primary ? theme.color.backgroundCanvas : theme.color.textPrimary} />
    {!iconOnly ? <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text> : null}
  </>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading, expanded }}
      disabled={blocked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.actionButton, primary ? styles.actionButtonPrimary : styles.actionButtonIcon, primary && width < 450 && styles.actionButtonPrimaryCompact, fullWidth && styles.actionButtonFull, iconOnly && styles.actionButtonIcon, blocked && styles.actionButtonDisabled, focused && Platform.OS === 'web' && controlStyles.webFocus]}
      testID={testID}
    >
      {primary ? <LinearGradient colors={[theme.color.accentPrimary, theme.color.accentMuted]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.actionGradient} testID="study-session-primary-gradient">{content}</LinearGradient> : content}
    </Pressable>
  );
}

/** A Ciclo counts `remaining` down against its `duration`; a Foco livre has no target and counts `elapsed` up. */
export type TimerReading = { remaining: number; duration: number } | { elapsed: number };

export function ForgeTimer({ reading, phase, size, testID, accessibilityLabel, elapsedCaption = 'tempo de foco' }: {
  reading: TimerReading;
  phase: string;
  size: number;
  testID?: string;
  accessibilityLabel?: string;
  /** What sits under a counting-up reading: the Foco livre says what it is, the Pronta says when it ends. */
  elapsedCaption?: string;
}) {
  const radius = 154;
  const circumference = 2 * Math.PI * radius;
  // Without a target there is nothing for the ring to fill: it stays an empty track.
  const progress = 'elapsed' in reading ? 0 : Math.max(0, Math.min(1, (reading.duration - reading.remaining) / reading.duration));

  return (
    <View style={[styles.timerRingWrap, { width: size, height: size }]}>
      <Svg aria-hidden width={size} height={size} viewBox="0 0 340 340" style={styles.timerRing}>
        <Defs>
          <SvgGradient id="forgeRingGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.color.accentHighlight} />
            <Stop offset="1" stopColor={theme.color.accentPrimary} />
          </SvgGradient>
        </Defs>
        <Circle cx="170" cy="170" r={radius} fill="none" stroke={theme.color.borderSoft} strokeWidth="2" />
        <Circle cx="170" cy="170" r={radius} fill="none" stroke="url(#forgeRingGradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </Svg>
      <View style={styles.timerCenter}>
        <Text allowFontScaling style={styles.timerPhase}>◈ {phase} ◈</Text>
        <Text accessibilityLiveRegion="none" aria-live="off" accessibilityLabel={accessibilityLabel} style={[styles.timerDigits, { fontSize: size < 290 ? 56 : 80, lineHeight: size < 290 ? 64 : 88 }]} testID={testID}>{'elapsed' in reading ? formatElapsedTime(reading.elapsed) : formatRemainingTime(reading.remaining)}</Text>
        <Text allowFontScaling style={styles.timerTarget}>{'elapsed' in reading ? elapsedCaption : `/ ${formatRemainingTime(reading.duration)}`}</Text>
      </View>
    </View>
  );
}

/** "Hoje" pill of the Forja header: sessions concluded today against the "Conclua 4 sessões hoje" Objetivo. Hidden until known. */
export function TodayPill({ compact = false }: { compact?: boolean }) {
  const { data: metrics } = useQuery(sessionMetricsQueryOptions());
  const objective = useSessionsObjective();
  if (!metrics) return null;
  const goal = objective ? Math.min(TODAY_BARS_LIMIT, objective.target) : 0;
  const { value, spoken } = formatSessionsToday(metrics.sessionsToday, objective);
  return (
    <View accessibilityLabel={`Hoje: ${spoken} sessões`} accessible style={[styles.todayPill, compact && styles.todayPillCompact]} testID="study-session-today">
      {compact ? null : <Text allowFontScaling style={styles.todayLabel}>Hoje</Text>}
      <View style={[styles.todayBars, compact && styles.todayBarsCompact]}>
        {Array.from({ length: goal }, (_, index) => (
          <View key={index} style={[styles.todayBar, compact && styles.todayBarCompact, index < (objective?.progress ?? 0) && styles.todayBarDone]} />
        ))}
      </View>
      <Text allowFontScaling style={styles.todayValue}>{compact ? `${spoken} hoje` : value}</Text>
    </View>
  );
}

/** The page heading: "Sessão Pomodoro" over the title with the "Hoje" pill beside it, compact on a phone. */
export function ForgeHeader({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.pageHeader, !compact && styles.pageHeaderWide]}>
      {compact ? (
        <Text accessibilityRole="header" allowFontScaling style={styles.pageTitleCompact}>Forja</Text>
      ) : (
        <View style={styles.pageHeaderTitles}>
          <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.pageEyebrow}>◈ Sessão Pomodoro</Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.pageTitle}>Forja</Text>
        </View>
      )}
      <TodayPill compact={compact} />
    </View>
  );
}
