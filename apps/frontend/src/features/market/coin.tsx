import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/design-system';
import { PixelSprite } from '@/features/character/PixelSprite';
import type { PixelSpriteData } from '@/features/character/sprites';
import { formatCoins } from './formatters';

/** The Moeda, drawn on the same 8×8 grid and palette as the Figma item sprites. */
export const coinSprite: PixelSpriteData = {
  palette: ['#0a0a12', '#f0c97a', '#d4a85a', '#8a6a3a'],
  rows: ['..aaaa..', '.abbbba.', 'abbccbca', 'abcbbdca', 'abcbbdca', 'abcddcca', '.acccca.', '..aaaa..'],
};

export function CoinMark({ scale = 2, style }: { scale?: number; style?: StyleProp<ViewStyle> }) {
  return <PixelSprite scale={scale} sprite={coinSprite} style={style} />;
}

/** A price or amount: the coin, then the figure in tabular mono. Read as "120 Moedas" by screen readers. */
export function CoinAmount({ dim = false, scale = 2, size = 14, testID, value }: { dim?: boolean; scale?: number; size?: number; testID?: string; value: number }) {
  return <View accessibilityLabel={`${formatCoins(value)} ${value === 1 ? 'Moeda' : 'Moedas'}`} accessible style={styles.amount} testID={testID}>
    <CoinMark scale={scale} />
    <Text style={[styles.figure, { fontSize: size, lineHeight: Math.round(size * 1.25) }, dim && styles.dim]}>{formatCoins(value)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  amount: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  figure: { fontFamily: 'JetBrainsMono-SemiBold', color: theme.color.textPrimary, fontVariant: ['tabular-nums'] },
  dim: { color: theme.color.textTertiary },
});
