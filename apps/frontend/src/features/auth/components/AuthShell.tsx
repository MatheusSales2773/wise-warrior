import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WiseText, theme } from '@/design-system';
import { BrandSigil } from '@/design-system/icons/brand-sigil';

export type AuthShellProps = PropsWithChildren<{ eyebrow: string; title: string; description: string }>;

export function AuthShell({ children }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={styles.brand}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <BrandSigil size={88} />
            </View>
            <WiseText variant="subtitle">Wise Warrior</WiseText>
          </View>
          <View style={styles.form}>
            <WiseText variant="title" accessibilityRole="header">Bem-vindo de volta</WiseText>
            <WiseText variant="body" color="textSecondary" style={styles.description}>Entre com seu e-mail para continuar.</WiseText>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 32, alignItems: 'center', justifyContent: 'center', gap: 64 },
  brand: { alignItems: 'center', gap: 12 },
  form: { width: '100%', maxWidth: 400 },
  description: { marginTop: 8, marginBottom: 28 },
});
