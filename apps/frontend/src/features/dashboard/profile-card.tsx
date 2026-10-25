import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FeedbackMessage, WiseButton, theme } from '@/design-system';
import { LayeredHero, type HeroLayers } from '@/features/character/layered-hero';
import { CoinAmount } from '@/features/market/coin';
import { coinsLabel } from '@/features/market/formatters';
import { display } from './card-chrome';

export function DashboardGlow({ hero = false }: { hero?: boolean }) {
  return <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
    <Defs>
      <RadialGradient id={hero ? 'dashboardHeroGlow' : 'dashboardPageGlow'} cx={hero ? '85%' : '50%'} cy={hero ? '50%' : '0%'} r={hero ? '55%' : '80%'}>
        <Stop offset="0" stopColor={hero ? theme.color.accentPrimary : theme.color.backgroundRaised} stopOpacity={hero ? '0.35' : '1'} />
        <Stop offset="1" stopColor={hero ? theme.color.accentPrimary : theme.color.backgroundCanvas} stopOpacity={hero ? '0' : '0'} />
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#${hero ? 'dashboardHeroGlow' : 'dashboardPageGlow'})`} />
  </Svg>;
}

/** The Herói in its frame, cropped to the head and torso as the Figma header shows it. Decorative. */
function HeroPortrait({ equipped, compact }: { equipped: HeroLayers; compact: boolean }) {
  return <View style={[styles.portrait, compact && styles.portraitCompact]} testID="dashboard-hero">
    <LayeredHero equipped={equipped} scale={compact ? 3 : 4} testID="dashboard-hero-sprite" style={compact ? styles.portraitSpriteCompact : styles.portraitSprite} />
  </View>;
}

/** The saldo de Moedas, a link to the Mercado. Read as "1.240 Moedas". */
function CoinBadge({ balance, compact }: { balance: number; compact: boolean }) {
  return <Link asChild href="/mercado">
    <Pressable accessibilityLabel={coinsLabel(balance)} accessibilityRole="link" style={StyleSheet.flatten([styles.coinBadge, compact && styles.coinBadgeCompact])} testID="dashboard-coins">
      <CoinAmount scale={2} size={compact ? 12 : 13} value={balance} />
    </Pressable>
  </Link>;
}

export type ProfileCardProps = {
  displayName: string;
  /** What the Herói wears. */
  equipped: HeroLayers;
  /** Unknown while it loads or fails: the badge is then left out. */
  coins?: number;
  /** The main button, when it sits in the header (desktop). */
  action?: ReactNode;
  title: string | null;
  compact: boolean;
  /** "Atualizando dados" / "Dados atualizados", announced politely; null while idle. */
  statusMessage: string | null;
  refreshing: boolean;
  /** The "Atualizar dados" button, shown only where the screen has no pull-to-refresh gesture. */
  showRefreshButton: boolean;
  onRefresh: () => void;
};

export function ProfileCard({ displayName, equipped, coins, action, title, compact, statusMessage, refreshing, showRefreshButton, onRefresh }: ProfileCardProps) {
  return <View accessibilityLabel="Resumo de perfil" role="region" style={styles.heroCard} testID="dashboard-profile">
    <LinearGradient colors={[theme.color.surfaceCard, theme.color.backgroundOverlay]} end={{ x: 1, y: 0.6 }} pointerEvents="none" start={{ x: 0, y: 0.4 }} style={StyleSheet.absoluteFill} />
    <DashboardGlow hero />
    <View style={[styles.heroContent, compact && styles.heroContentCompact]} testID="dashboard-profile-content">
      <HeroPortrait compact={compact} equipped={equipped} />
      <View style={styles.heroCopy}>
        <View style={styles.heroGreetingRow}>
          <Text aria-hidden style={styles.heroGreeting}>✦</Text>
          <Text accessibilityRole="header" aria-level={2} style={styles.heroGreeting}>Boas-vindas, {displayName}</Text>
        </View>
        <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{title || 'Sua jornada começa aqui'}</Text>
        <View testID="dashboard-status" accessibilityLiveRegion="polite" aria-live="polite" aria-atomic style={styles.status}>{statusMessage ? <Text style={[styles.statusText, { color: refreshing ? theme.color.accentPrimary : theme.color.feedbackSuccess }]}>{statusMessage}</Text> : null}</View>
      </View>
      {coins === undefined ? null : <CoinBadge balance={coins} compact={compact} />}
      {showRefreshButton ? <WiseButton label="Atualizar dados" loading={refreshing} onPress={onRefresh} variant="ghost" /> : null}
      {action}
    </View>
  </View>;
}

/** Shown under the profile card when a background refresh of the profile fails and the cached one stays on screen. */
export function ProfileRefreshError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <View style={styles.inlineError} testID="dashboard-profile-refresh-error">
      <FeedbackMessage message="Não foi possível atualizar seu progresso." title="Progresso desatualizado" variant="error" />
      <WiseButton label="Tentar novamente" loading={retrying} onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  inlineError: { gap: theme.space.stackDefault },
  heroCard: { position: 'relative', overflow: 'hidden', borderRadius: theme.radius.control, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, paddingVertical: 28, paddingHorizontal: 32 },
  heroContentCompact: { padding: 22, gap: theme.space.controlInset },
  portrait: { width: 56, height: 56, overflow: 'hidden', borderRadius: 5, borderWidth: theme.border.standard, borderColor: theme.color.accentMuted, backgroundColor: theme.color.surfaceInset },
  portraitCompact: { width: 48, height: 48 },
  portraitSprite: { marginLeft: -4, marginTop: 3 },
  portraitSpriteCompact: { marginLeft: -1, marginTop: 2 },
  coinBadge: { flexShrink: 0, minHeight: theme.layout.touchTarget, justifyContent: 'center', borderRadius: 3, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset, paddingLeft: 14, paddingRight: 16 },
  coinBadgeCompact: { borderRadius: 999, paddingLeft: 9, paddingRight: 10 },
  heroCopy: { flexShrink: 1, flexGrow: 1, flexBasis: 0, minWidth: 120, maxWidth: 540 },
  heroGreetingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.inlineHairline },
  heroGreeting: { ...display, fontSize: 9, lineHeight: 14, letterSpacing: 2.9, textTransform: 'uppercase', color: theme.color.accentPrimary },
  heroTitle: { ...display, fontSize: 26, lineHeight: 34, letterSpacing: 1, color: theme.color.textPrimary, marginTop: 6, marginBottom: 4 },
  heroTitleCompact: { fontSize: 22, lineHeight: 30 },
  status: { minHeight: 16 },
  statusText: { fontFamily: 'Inter-Regular', fontSize: 11, lineHeight: 16, letterSpacing: 0.9 },
});
