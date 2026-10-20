import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/design-system';
import { PixelSprite } from '@/features/character/PixelSprite';
import type { RaidRankingEntry } from './api';
import { heroOf, partyHeroSprites } from './raid-battle';

/** The 32 px portrait of a Participante: the hero of the equipped Avatar, or the default hero without one, cropped to the frame. Decorative: the row text names the member. */
export function HeroAvatar({ entry, style }: { entry?: Pick<RaidRankingEntry, 'avatar'>; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.frame, style]} testID="hero-avatar">
      <PixelSprite scale={2} sprite={partyHeroSprites[heroOf(entry ?? { avatar: null })]} style={styles.sprite} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 32, height: 32, overflow: 'hidden', borderRadius: 4, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceInset },
  sprite: { position: 'absolute', left: -1, top: 0 },
});
