import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BrandSigil, screenGutter, WiseCard, WiseText, theme } from '@/design-system';

export type AuthShellProps = PropsWithChildren<{ eyebrow: string; title: string; description: string }>;

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 860;

  return (
    <SafeAreaView style={styles.screen}>
      <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="authPageGlow" cx="20%" cy="0%" r="75%">
            <Stop offset="0" stopColor={theme.color.accentPrimary} stopOpacity="0.12" />
            <Stop offset="1" stopColor={theme.color.accentPrimary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#authPageGlow)" />
      </Svg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: screenGutter(Platform.OS, width) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={[styles.layout, desktop ? styles.desktopLayout : styles.mobileLayout]}>
            <View style={[styles.story, desktop && styles.storyDesktop]}>
              <View style={styles.brand}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.brandMark}>
                  <BrandSigil size={theme.iconSize.large} />
                </View>
                <Text style={styles.brandName}>Wise</Text>
              </View>
              <View style={[styles.copy, desktop && styles.copyDesktop]}>
                <WiseText variant="label" color="accentPrimary">
                  {eyebrow}
                </WiseText>
                <WiseText accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]} variant="display">
                  {title}
                </WiseText>
                <WiseText variant="body" color="textSecondary" style={[styles.description, desktop && styles.descriptionDesktop]}>
                  {description}
                </WiseText>
              </View>
              <View style={styles.quote}>
                <Text style={styles.quoteText}>“O foco é forjado, uma sessão de cada vez.”</Text>
                <Text style={styles.quoteSource}>Códice do Guerreiro · I</Text>
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
  content: { flexGrow: 1, paddingVertical: theme.space.cardInset, justifyContent: 'center' },
  layout: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
  mobileLayout: { alignItems: 'stretch', gap: theme.space.cardInset },
  desktopLayout: { flexDirection: 'row', alignItems: 'center', gap: theme.space.pageGap },
  story: { minWidth: 0, gap: theme.space.cardInset, alignItems: 'center' },
  storyDesktop: { flex: 1.05, alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight },
  brandMark: { width: 52, height: 52, borderWidth: 1, borderColor: theme.color.borderEmphasis, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.backgroundOverlay },
  brandName: { fontFamily: 'Cinzel-Bold', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: theme.color.accentHighlight },
  copy: { gap: theme.space.stackTight, alignItems: 'center' },
  copyDesktop: { alignItems: 'flex-start' },
  title: { marginTop: theme.space.inlineTight, textAlign: 'center' },
  titleDesktop: { textAlign: 'left' },
  form: { width: '100%', maxWidth: 520, padding: theme.space.cardInset, borderWidth: 1, borderColor: theme.color.borderEmphasis },
  desktopForm: { flex: 0.95 },
  description: { maxWidth: 440, textAlign: 'center', lineHeight: 26 },
  descriptionDesktop: { textAlign: 'left' },
  quote: { maxWidth: 440, alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: theme.color.borderEmphasis, paddingLeft: theme.space.controlInset, gap: theme.space.inlineTight },
  quoteText: { fontFamily: 'Cinzel-SemiBold', fontSize: 13, lineHeight: 21, color: theme.color.accentHighlight },
  quoteSource: { fontFamily: 'Inter-Medium', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.color.textTertiary },
});
