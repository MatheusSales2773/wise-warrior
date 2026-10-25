import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/design-system';
import type { FocusCycle, StudySessionSnapshot } from '@/features/study-session/api';
import { activeFocus, cycleMarkers, focusButtonText, focusCaption, type ActiveFocus } from './focus-action-model';

function PlayGlyph({ size = 12 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill={theme.color.backgroundCanvas} />
  </Svg>;
}

/** The active Study Session as the button reads it, ticking each second while it runs; `null` without one. */
export function useActiveFocus(active: StudySessionSnapshot | null | undefined): ActiveFocus | null {
  const [now, setNow] = useState(() => Date.now());
  const running = active?.state === 'running';
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running, active?.id]);
  return active ? activeFocus(active, now) : null;
}

type FocusActionProps = {
  /** Unknown while it loads or fails: the button then says only "Iniciar foco". */
  cycle?: FocusCycle;
  /** The active Study Session, which turns the button into "Retomar foco". */
  focus: ActiveFocus | null;
  /** On the fixed mobile bar, the Ciclo and the session are written above the button, not on it. */
  fixed?: boolean;
};

/** The main button: "Iniciar foco · 3/4", or "Retomar foco · Matéria · 18:42" with an active Study Session. Opens the Forja. */
export function FocusAction({ cycle, focus, fixed = false }: FocusActionProps) {
  const { label, detail, accessibilityLabel } = focusButtonText(cycle, focus, fixed);
  return <Link asChild href="/sessao">
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel} style={StyleSheet.flatten([styles.focusAction, fixed && styles.fixedAction])} testID="dashboard-focus-action">
      <LinearGradient colors={[theme.color.accentPrimary, theme.color.accentMuted]} end={{ x: 0, y: 1 }} start={{ x: 0, y: 0 }} style={styles.focusGradient}>
        <PlayGlyph />
        <Text style={styles.focusText}>{label}</Text>
        {detail ? <Text style={styles.focusDetail}>{detail}</Text> : null}
      </LinearGradient>
    </Pressable>
  </Link>;
}

/** Mobile: the Ciclo markers and caption above the fixed button. */
export function FocusFooter({ cycle, focus }: Pick<FocusActionProps, 'cycle' | 'focus'>) {
  const caption = focusCaption(cycle, focus);
  return <View style={styles.footer} testID="dashboard-focus-footer">
    {cycle || caption ? <View style={styles.cycleRow} testID="dashboard-cycle">
      {cycle ? <>
        <Text style={styles.cycleLabel}>Ciclo</Text>
        {cycleMarkers(cycle).map((marker, index) => <View key={index} style={[styles.marker, styles[marker]]} testID={`dashboard-cycle-marker-${marker}`} />)}
      </> : null}
      {caption ? <Text style={[styles.caption, focus && styles.captionActive]} testID="dashboard-cycle-caption">{caption}</Text> : null}
    </View> : null}
    <FocusAction cycle={cycle} fixed focus={focus} />
  </View>;
}

const styles = StyleSheet.create({
  focusAction: { minHeight: theme.layout.touchTarget, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.accentHighlight, overflow: 'hidden', shadowColor: theme.color.accentPrimary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  fixedAction: { width: '100%' },
  focusGradient: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight, paddingHorizontal: 22 },
  focusText: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 16, letterSpacing: 2.2, textTransform: 'uppercase', color: theme.color.backgroundCanvas },
  focusDetail: { fontFamily: 'JetBrainsMono-Bold', fontSize: 11, lineHeight: 16, color: theme.color.backgroundCanvas },
  footer: { gap: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.color.backgroundRaised, borderTopWidth: 1, borderTopColor: theme.color.borderGhost },
  cycleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  cycleLabel: { fontFamily: 'Inter-Medium', fontSize: 9, lineHeight: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.textTertiary },
  marker: { width: 18, height: 4, borderRadius: 1, borderWidth: 1, borderColor: theme.color.borderGhost },
  done: { backgroundColor: theme.color.accentPrimary },
  next: { backgroundColor: theme.color.surfaceInset, borderColor: theme.color.accentHighlight },
  pending: { backgroundColor: theme.color.surfaceInset },
  caption: { flexShrink: 1, fontFamily: 'JetBrainsMono-Medium', fontSize: 9, lineHeight: 13, color: theme.color.textTertiary },
  captionActive: { color: theme.color.accentHighlight },
});
