import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/design-system';
import { LayeredHero } from '@/features/character/layered-hero';
import type { EquippedAppearance } from './api';

/** The 32 px portrait of a Participante: the base body with the equipped Avatar (the initial one without it), no Arma, cropped to the frame. Decorative: the row text names the member. */
export function HeroAvatar({ entry, style }: { entry?: Pick<EquippedAppearance, 'avatar'>; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.frame, style]} testID="hero-avatar">
      <LayeredHero equipped={{ avatar: entry?.avatar ?? null, weapon: null, accessory: null }} scale={2} style={styles.hero} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 32, height: 32, overflow: 'hidden', borderRadius: 4, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  hero: { position: 'absolute', left: -1, top: 0 },
});
