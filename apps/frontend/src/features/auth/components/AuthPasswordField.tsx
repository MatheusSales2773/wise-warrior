import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { WiseField, type WiseFieldProps } from '@/design-system/components/WiseField';
import { WiseText } from '@/design-system/components/WiseText';
import { theme } from '@/design-system/tokens/theme';

export type AuthPasswordFieldProps = Omit<WiseFieldProps, 'secureTextEntry' | 'trailing'>;

/**
 * Campo de senha com ação acessível Mostrar/Ocultar. O estado pressionado é
 * explícito e a ação nunca submete o formulário.
 */
export function AuthPasswordField({ label, ...fieldProps }: AuthPasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
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
          onPress={() => setRevealed((value) => !value)}
          style={styles.toggle}
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
});
