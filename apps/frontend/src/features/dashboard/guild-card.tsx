import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/design-system';
import { GuildSigil } from '@/features/guild/guild-emblem';
import { FramedCard, cardText, display } from './card-chrome';

function ChevronGlyph({ size = 12 }: { size?: number }) {
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 5l7 7-7 7" stroke={theme.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

/** The fixed "guilda em preparação" card. The Raid card replaces it once the dashboard has the Raid data. */
export function GuildCard() {
  return <FramedCard accessibilityLabel="Guilda" role="region" testID="dashboard-guild-preview">
    <View style={styles.guildHeader}>
      <LinearGradient colors={[theme.color.backgroundOverlay, 'transparent']} pointerEvents="none" style={StyleSheet.absoluteFill} />
      <GuildSigil size={40} />
      <View style={styles.guildHeaderCopy}>
        <Text style={styles.guildEyebrow}>Guilda</Text>
        <Text accessibilityRole="header" aria-level={2} style={styles.guildName}>Sua guilda</Text>
      </View>
    </View>
    <View style={styles.guildBody}>
      <Text style={cardText.cardDescription}>Sua guilda está em preparação. Em breve vocês enfrentarão raids juntos.</Text>
      <Link asChild href="/guilda">
        <Pressable accessibilityRole="link" accessibilityLabel="Entrar na Guilda">
          <View style={styles.guildAction}>
            <Text style={styles.guildActionText}>Entrar na Guilda</Text>
            <ChevronGlyph />
          </View>
        </Pressable>
      </Link>
    </View>
  </FramedCard>;
}

const styles = StyleSheet.create({
  guildHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: 18, paddingHorizontal: 22, borderBottomWidth: theme.border.standard, borderBottomColor: theme.color.borderGhost, overflow: 'hidden', borderTopLeftRadius: theme.radius.control, borderTopRightRadius: theme.radius.control },
  guildHeaderCopy: { flexShrink: 1, gap: 2 },
  guildEyebrow: { fontFamily: 'Inter-SemiBold', fontSize: 9, lineHeight: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.color.accentPrimary },
  guildName: { ...display, fontSize: 13, lineHeight: 18, letterSpacing: 0.8, color: theme.color.textPrimary },
  guildBody: { padding: 22, gap: 16 },
  guildAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.inlineTight, paddingHorizontal: 14, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.detail },
  guildActionText: { ...display, fontSize: 10, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase', color: theme.color.textPrimary },
});
