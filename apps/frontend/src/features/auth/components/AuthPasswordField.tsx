import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WiseField, theme, type WiseFieldProps } from '@/design-system';

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
          <EyeGlyph color={focused ? theme.color.accentPrimary : theme.color.textTertiary} crossed={revealed} />
        </Pressable>
      }
    />
  );
}

function EyeGlyph({ color, crossed }: { color: string; crossed: boolean }) {
  return (
    <Svg aria-hidden width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.6} />
      {crossed ? <Path d="M4 4l16 16" stroke={color} strokeWidth={1.6} strokeLinecap="round" /> : null}
    </Svg>
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
