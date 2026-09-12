import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandSigil, isDesktopLayout, screenGutter, WiseCard, WiseText, theme } from '@/design-system';

export type AuthShellProps = PropsWithChildren<{ eyebrow: string; title: string; description: string }>;

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: screenGutter(Platform.OS, width) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={[styles.layout, desktop ? styles.desktopLayout : styles.mobileLayout]}>
            <View style={styles.story}>
              <View style={styles.brand}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <BrandSigil size={theme.iconSize.large * 3} />
                </View>
                <WiseText variant="subtitle">Wise Warrior</WiseText>
              </View>
              <View style={styles.copy}>
                <WiseText variant="label" color="accentPrimary">
                  {eyebrow}
                </WiseText>
                <WiseText accessibilityRole="header" style={styles.title} variant="display">
                  {title}
                </WiseText>
                <WiseText variant="body" color="textSecondary" style={styles.description}>
                  {description}
                </WiseText>
              </View>
            </View>
            <WiseCard style={[styles.form, desktop && styles.desktopForm]} variant="elevated">
              {children}
            </WiseCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: theme.space.sectionGap, justifyContent: 'center' },
  layout: { width: '100%', maxWidth: theme.layout.contentMaxWidth, alignSelf: 'center' },
  mobileLayout: { alignItems: 'center', gap: theme.space.heroGap },
  desktopLayout: { flexDirection: 'row', alignItems: 'center', gap: theme.space.pageGap },
  story: { flex: 1, gap: theme.space.heroGap },
  brand: { alignItems: 'center', gap: theme.space.stackTight },
  copy: { gap: theme.space.stackTight },
  title: { marginTop: theme.space.stackDefault },
  form: { width: '100%', maxWidth: 520, padding: theme.space.cardInset },
  desktopForm: { flex: 1 },
  description: { marginTop: theme.space.stackDefault },
});
