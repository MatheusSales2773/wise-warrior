import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { controlStyles } from '@/design-system/components/control-styles';
import { WiseText } from '@/design-system/components/WiseText';
import { theme } from '@/design-system/tokens/theme';

type AuthNavigationLinkProps = {
  href: '/entrar' | '/cadastro';
  label: string;
};

export function AuthNavigationLink({ href, label }: AuthNavigationLinkProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Link
      href={href}
      asChild
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="link"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        style={StyleSheet.flatten([
          styles.link,
          focused && Platform.OS === 'web' && controlStyles.webFocus,
        ])}
      >
        <WiseText color="accentPrimary" variant="label">{label}</WiseText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.inlineTight,
  },
});
