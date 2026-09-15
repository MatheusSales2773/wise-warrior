import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { WiseField, WiseText, theme, type WiseFieldProps } from '@/design-system';

export type AuthPasswordFieldProps = Omit<WiseFieldProps, 'secureTextEntry' | 'trailing'>;

/**
 * Campo de senha com ação acessível Mostrar/Ocultar. O estado pressionado é
 * explícito e a ação nunca submete o formulário.
 */
export function AuthPasswordField({ label, ...fieldProps }: AuthPasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const action = revealed ? 'Ocultar senha' : 'Mostrar senha';

  return (
    <WiseField
      {...fieldProps}
      label={label}
      secureTextEntry={!revealed}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityState={{ selected: revealed }}
          aria-pressed={revealed}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onPress={() => setRevealed((value) => !value)}
          style={[styles.toggle, focused && Platform.OS === 'web' && styles.webFocus]}
        >
          <WiseText variant="label" color="accentPrimary">{revealed ? 'Ocultar' : 'Mostrar'}</WiseText>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.inlineTight,
  },
  webFocus: {
    outlineColor: theme.color.accentPrimary,
    outlineStyle: 'solid',
    outlineWidth: theme.border.focus,
  },
});
