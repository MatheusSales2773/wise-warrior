import { LinearGradient } from 'expo-linear-gradient';
import { useId, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { theme, type SemanticColor } from '../tokens/theme';
import { WiseText } from './WiseText';
import { controlStyles } from './control-styles';
import { useFontFallback } from './font-runtime';

export type WiseButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type WiseButtonSize = 'medium' | 'large';
export type WiseButtonProps = Pick<PressableProps, 'onPress' | 'testID' | 'accessibilityLabel'> & {
  label: string;
  variant?: WiseButtonVariant;
  size?: WiseButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Decorative glyph rendered after the label, e.g. a chevron. */
  trailing?: ReactNode;
};

const variants = {
  primary: { background: 'accentPrimary', text: 'backgroundCanvas', border: 'accentPrimary', active: 'accentHighlight' },
  secondary: { background: 'surfaceCard', text: 'textPrimary', border: 'borderEmphasis', active: 'surfaceCardActive' },
  ghost: { background: 'backgroundCanvas', text: 'textPrimary', border: 'borderEmphasis', active: 'surfaceCardActive' },
  danger: { background: 'surfaceInset', text: 'textPrimary', border: 'feedbackDanger', active: 'surfaceCardActive' },
} satisfies Record<WiseButtonVariant, Record<'background' | 'text' | 'border' | 'active', SemanticColor>>;

export function WiseButton({ label, variant = 'primary', size = 'medium', disabled = false, loading = false, accessibilityLabel, onPress, testID, trailing }: WiseButtonProps) {
  const loadingId = useId();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const active = !blocked && (hovered || pressed);
  const colors = variants[variant];
  const labelColor = disabled ? 'textSecondary' : active && variant !== 'primary' && variant !== 'danger' ? 'accentHighlight' : colors.text;
  const fallback = useFontFallback();
  const labelStyle = [styles.label, variant === 'primary' && styles.primaryLabel, fallback && styles.fallbackLabel, { color: theme.color[labelColor] }];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      aria-disabled={blocked}
      aria-busy={loading}
      accessibilityHint={loading ? 'Carregando' : undefined}
      aria-describedby={loading ? loadingId : undefined}
      disabled={blocked}
      onPress={blocked ? undefined : onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        variant === 'primary' && !disabled && styles.primaryGlow,
        { paddingVertical: size === 'large' ? theme.space.stackTight : theme.space.inlineTight },
        {
          backgroundColor: theme.color[disabled ? 'surfaceInset' : active ? colors.active : colors.background],
          borderColor: theme.color[active ? 'accentHighlight' : colors.border],
        },
        focused && Platform.OS === 'web' && controlStyles.webFocus,
      ]}
    >
      {variant === 'primary' && !disabled ? (
        <LinearGradient
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          colors={active ? [theme.color.accentHighlight, theme.color.accentPrimary] : [theme.color.accentPrimary, theme.color.accentMuted]}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={styles.gradient}
        />
      ) : null}
      <Text allowFontScaling style={labelStyle}>{label}</Text>
      {trailing ? <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{trailing}</View> : null}
      {/* Reserve the indicator slot in every state, including during font scaling. */}
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: loading ? 1 : 0 }}>
        <Text allowFontScaling style={labelStyle}>…</Text>
      </View>
      {Platform.OS === 'web' && (
        <WiseText nativeID={loadingId} variant="label" style={styles.announcement}>{loading ? 'Carregando' : ''}</WiseText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: theme.layout.touchTarget,
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: 22,
    borderRadius: theme.radius.detail,
    overflow: 'hidden',
    borderWidth: theme.border.standard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.inlineTight,
  },
  gradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  primaryGlow: { shadowColor: theme.color.accentPrimary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  label: { fontFamily: 'Cinzel-SemiBold', fontSize: 11, lineHeight: 16, letterSpacing: 2.2, textTransform: 'uppercase', textAlign: 'center', flexShrink: 1 },
  primaryLabel: { fontFamily: 'Cinzel-Bold' },
  fallbackLabel: { fontFamily: 'serif' },
  announcement: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
