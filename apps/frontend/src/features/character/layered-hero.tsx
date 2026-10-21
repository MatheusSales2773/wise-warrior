import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { EquippedItems } from './catalog';
import { PixelSprite } from './PixelSprite';
import { accessoryLayers, avatarLayers, heroBody, initialAvatarLayer } from './sprites';

const GRID_WIDTH = 16;
const GRID_HEIGHT = 24;

/** The layer drawn for the equipped Avatar: its own art, or the initial Avatar's when it has none or the slot is empty. */
export function avatarLayerFor(equipped: Pick<EquippedItems, 'avatar'>) {
  return (equipped.avatar && avatarLayers[equipped.avatar.name]) || initialAvatarLayer;
}

/**
 * The Herói: the neutral body, the Avatar layer and the Acessório layer stacked on one 16 × 24 grid (ADR-013).
 * Decorative: the equipped items are named by the text around it.
 */
export function LayeredHero({ equipped, scale, style, testID }: { equipped: Pick<EquippedItems, 'avatar' | 'accessory'>; scale: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  const accessory = equipped.accessory && accessoryLayers[equipped.accessory.name];
  return <View
    accessibilityElementsHidden
    aria-hidden
    importantForAccessibility="no-hide-descendants"
    pointerEvents="none"
    style={[{ width: GRID_WIDTH * scale, height: GRID_HEIGHT * scale }, style]}
    testID={testID}
  >
    <PixelSprite scale={scale} sprite={heroBody} testID="character-hero-layer-body" />
    <PixelSprite scale={scale} sprite={avatarLayerFor(equipped)} style={styles.layer} testID="character-hero-layer-avatar" />
    {accessory ? <PixelSprite scale={scale} sprite={accessory} style={styles.layer} testID="character-hero-layer-accessory" /> : null}
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
