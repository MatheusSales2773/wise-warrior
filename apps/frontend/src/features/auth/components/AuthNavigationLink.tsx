import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { controlStyles } from '@/design-system/components/control-styles';
import { theme } from '@/design-system/tokens/theme';

type AuthNavigationLinkProps = {
  href: '/entrar' | '/cadastro';
  label: string;
  /** Muted lead-in shown before the underlined action, e.g. "Ainda não tem uma conta?". */
  prompt?: string;
};

export function AuthNavigationLink({ href, label, prompt }: AuthNavigationLinkProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Link
      href={href}
      asChild
    >
      <Pressable
        accessibilityLabel={prompt ? `${prompt} ${label}` : label}
        accessibilityRole="link"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        style={StyleSheet.flatten([
          styles.link,
          focused && Platform.OS === 'web' && controlStyles.webFocus,
        ])}
      >
        <Text allowFontScaling style={styles.text}>
          {prompt ? <Text style={styles.prompt}>{prompt} </Text> : null}
          <Text style={styles.action}>{label}</Text>
        </Text>
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
  text: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  prompt: { color: theme.color.textTertiary },
  action: { color: theme.color.accentPrimary, textDecorationLine: 'underline' },
});
