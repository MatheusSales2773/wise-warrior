import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { WiseText, theme } from '@/design-system';

type AuthNavigationLinkProps = {
  href: '/entrar' | '/cadastro';
  label: string;
};

export function AuthNavigationLink({ href, label }: AuthNavigationLinkProps) {
  return (
    <Link
      href={href}
      asChild
    >
      <Pressable accessibilityLabel={label} accessibilityRole="link" style={styles.link}>
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
