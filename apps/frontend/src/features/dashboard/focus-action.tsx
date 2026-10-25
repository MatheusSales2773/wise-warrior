import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/design-system';

function FlameGlyph({ size = 15 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c.5 3.5 4.5 5.5 4.5 10a4.5 4.5 0 1 1-9 0c0-2.3 1.2-3.6 2.2-4.8.3 1.6 1.1 2.6 2.3 3.1C11.4 8.8 11 6 12 3Z" stroke={theme.color.backgroundCanvas} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>;
}

/** The main "Iniciar foco" button, which opens the Forja. */
export function FocusAction() {
  return <Link asChild href="/sessao">
    <Pressable accessibilityRole="link" accessibilityLabel="Iniciar foco" style={styles.focusAction}>
      <LinearGradient colors={[theme.color.accentPrimary, theme.color.accentMuted]} end={{ x: 0, y: 1 }} start={{ x: 0, y: 0 }} style={styles.focusGradient}>
        <FlameGlyph />
        <Text style={styles.focusText}>Iniciar foco</Text>
      </LinearGradient>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({
  focusAction: { minHeight: theme.layout.touchTarget, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.accentHighlight, overflow: 'hidden', shadowColor: theme.color.accentPrimary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  focusGradient: { minHeight: theme.layout.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight, paddingHorizontal: 22 },
  focusText: { fontFamily: 'Cinzel-Bold', fontSize: 11, lineHeight: 16, letterSpacing: 2.2, textTransform: 'uppercase', color: theme.color.backgroundCanvas },
});
