import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, WiseCard, WiseText } from '@/design-system';
import { theme } from '@/design-system/tokens/theme';

export type AuthShellProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>;

/**
 * Composição pública compartilhada: marca, painel narrativo e slot do
 * formulário. Usa apenas o design system existente e nunca o shell autenticado.
 */
export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <Screen testID="auth-screen" title="Wise Warrior" titleVariant="display">
      <WiseCard style={styles.card} variant="ornamented">
        <View style={styles.intro}>
          <WiseText color="accentPrimary" variant="caption">{eyebrow}</WiseText>
          <WiseText accessibilityRole="header" variant="title">{title}</WiseText>
          <WiseText color="textSecondary" variant="body">{description}</WiseText>
        </View>
        <View style={styles.form}>{children}</View>
      </WiseCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  intro: { gap: theme.space.inlineTight, marginBottom: theme.space.cardInset },
  form: { gap: theme.space.stackDefault },
});
