import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { isSemanticColor, theme, type SemanticColor } from '../tokens/theme';

export const wiseIconNames = [
  'home-outline',
  'home',
  'hammer-outline',
  'hammer',
  'person-outline',
  'person',
  'shield-outline',
  'shield',
  'ellipsis-horizontal-circle-outline',
  'ellipsis-horizontal-circle',
] as const;

export type WiseIconName = (typeof wiseIconNames)[number];
export type WiseIconColor = SemanticColor;
export type WiseIconSize = keyof typeof theme.iconSize;

type IoniconsProps = ComponentProps<typeof Ionicons>;
type WiseIconStyle = Omit<TextStyle, 'color' | 'fontSize'>;

export type WiseIconProps = Omit<
  IoniconsProps,
  'accessibilityElementsHidden' | 'accessibilityLabel' | 'accessibilityRole' | 'accessible' | 'color' | 'name' | 'size' | 'style'
> & {
  accessibilityLabel?: string;
  color?: WiseIconColor;
  decorative?: boolean;
  name: WiseIconName;
  size?: WiseIconSize;
  style?: StyleProp<WiseIconStyle>;
};

function isWiseIconName(name: string): name is WiseIconName {
  return (wiseIconNames as readonly string[]).includes(name);
}

function isWiseIconSize(size: unknown): size is WiseIconSize {
  return typeof size === 'string' && Object.prototype.hasOwnProperty.call(theme.iconSize, size);
}

export function WiseIcon({
  accessibilityLabel,
  color = 'textPrimary',
  decorative = true,
  name,
  size = 'medium',
  style,
  ...iconProps
}: WiseIconProps) {
  if (!isWiseIconName(name)) {
    throw new Error(`WiseIcon received unsupported icon name "${String(name)}".`);
  }
  if (!isSemanticColor(color)) {
    throw new Error(`WiseIcon received unsupported semantic color "${String(color)}".`);
  }
  if (!isWiseIconSize(size)) {
    throw new Error(`WiseIcon received unsupported icon size "${String(size)}".`);
  }

  const informative = decorative === false || accessibilityLabel !== undefined;
  if (informative && !accessibilityLabel?.trim()) {
    throw new Error('WiseIcon requires an accessible label when it is informative.');
  }

  const flattenedStyle = StyleSheet.flatten(style as StyleProp<TextStyle>) ?? {};
  const { color: _styleColor, fontSize: _styleSize, ...safeStyle } = flattenedStyle;

  return (
    <Ionicons
      {...iconProps}
      accessibilityElementsHidden={!informative}
      accessibilityLabel={informative ? accessibilityLabel : undefined}
      accessibilityRole={informative ? 'image' : undefined}
      accessible={informative}
      color={theme.color[color]}
      importantForAccessibility={informative ? 'auto' : 'no'}
      name={name}
      size={theme.iconSize[size]}
      style={safeStyle}
    />
  );
}
