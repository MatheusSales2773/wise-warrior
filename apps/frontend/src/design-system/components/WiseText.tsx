import { StyleSheet, Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { useFontFallback } from './font-runtime';
import { isSemanticColor, theme, typographyFor, type SemanticColor } from '../tokens/theme';

export type WiseTextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'mono';
export type WiseTextColor = SemanticColor;

type WiseTextStyle = Omit<
  TextStyle,
  'color' | 'fontFamily' | 'fontSize' | 'fontStyle' | 'fontVariant' | 'fontWeight' | 'letterSpacing' | 'lineHeight' | 'textTransform'
>;

export type WiseTextProps = Omit<TextProps, 'allowFontScaling' | 'style'> & {
  allowFontScaling?: boolean;
  color?: WiseTextColor;
  style?: StyleProp<WiseTextStyle>;
  variant: WiseTextVariant;
};

export function WiseText({
  allowFontScaling = true,
  color = 'textPrimary',
  style,
  variant,
  ...textProps
}: WiseTextProps) {
  if (!isSemanticColor(color)) {
    throw new Error(`WiseText received unsupported semantic color "${String(color)}".`);
  }

  const useFallback = useFontFallback();
  const flattenedStyle = StyleSheet.flatten(style as StyleProp<TextStyle>) ?? {};
  const {
    color: _styleColor,
    fontFamily: _styleFontFamily,
    fontSize: _styleFontSize,
    fontStyle: _styleFontStyle,
    fontVariant: _styleFontVariant,
    fontWeight: _styleFontWeight,
    letterSpacing: _styleLetterSpacing,
    lineHeight: _styleLineHeight,
    textTransform: _styleTextTransform,
    ...safeStyle
  } = flattenedStyle;

  return (
    <Text
      {...textProps}
      allowFontScaling={allowFontScaling}
      style={[safeStyle, typographyFor(variant, useFallback), { color: theme.color[color] }]}
    />
  );
}
