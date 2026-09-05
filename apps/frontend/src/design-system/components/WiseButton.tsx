import { useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { theme, type SemanticColor } from '../tokens/theme';
import { WiseText } from './WiseText';
import { controlStyles } from './control-styles';

export type WiseButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type WiseButtonSize = 'medium' | 'large';
export type WiseButtonProps = Pick<PressableProps, 'onPress' | 'testID' | 'accessibilityLabel'> & {
  label: string;
  variant?: WiseButtonVariant;
  size?: WiseButtonSize;
  disabled?: boolean;
  loading?: boolean;
};

const variants = {
  primary: { background: 'accentPrimary', text: 'backgroundCanvas', border: 'accentPrimary', active: 'accentHighlight' },
  secondary: { background: 'surfaceCard', text: 'textPrimary', border: 'borderEmphasis', active: 'surfaceCardActive' },
  ghost: { background: 'backgroundCanvas', text: 'accentPrimary', border: 'backgroundCanvas', active: 'surfaceCardActive' },
  danger: { background: 'surfaceInset', text: 'textPrimary', border: 'feedbackDanger', active: 'surfaceCardActive' },
} satisfies Record<WiseButtonVariant, Record<'background' | 'text' | 'border' | 'active', SemanticColor>>;

export function WiseButton({ label, variant = 'primary', size = 'medium', disabled = false, loading = false, accessibilityLabel, onPress, testID }: WiseButtonProps) {
  const loadingId = useId();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const active = !blocked && (hovered || pressed);
  const colors = variants[variant];

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
        { paddingVertical: size === 'large' ? theme.space.stackTight : theme.space.inlineTight },
        {
          backgroundColor: theme.color[disabled ? 'surfaceInset' : active ? colors.active : colors.background],
          borderColor: theme.color[active ? 'accentHighlight' : colors.border],
        },
        focused && Platform.OS === 'web' && controlStyles.webFocus,
      ]}
    >
      <WiseText variant="label" color={disabled ? 'textSecondary' : colors.text}>{label}</WiseText>
      {/* Reserve the indicator slot in every state, including during font scaling. */}
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: loading ? 1 : 0 }}>
        <WiseText variant="label" color={disabled ? 'textSecondary' : colors.text}>…</WiseText>
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
    paddingHorizontal: theme.space.controlInset,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.inlineTight,
  },
  announcement: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
