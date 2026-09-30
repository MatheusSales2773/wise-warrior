import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BrandSigil, screenGutter, WiseText, theme } from '@/design-system';

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
                <Text style={[styles.eyebrow, desktop && styles.textLeft]}>{eyebrow}</Text>
                <Text accessibilityRole="header" allowFontScaling style={[styles.title, desktop && styles.titleDesktop]}>
                  {title}
                </Text>
                <WiseText variant="body" color="textSecondary" style={[styles.description, desktop && styles.descriptionDesktop]}>
                  {description}
                </WiseText>
              </View>
              <View style={styles.quote}>
                <Text style={styles.quoteText}>“O foco é forjado, uma sessão de cada vez.”</Text>
                <Text style={styles.quoteSource}>Códice do Guerreiro · I</Text>
              </View>
            </View>
            <View style={[styles.form, !desktop && width < 480 && styles.formCompact, desktop && styles.desktopForm]}>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Chevron shown after the primary auth action label. */
export function AuthChevron() {
  return (
    <Svg aria-hidden width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={theme.color.backgroundCanvas} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Centered heading inside the auth card ("Abra seu grimório"). */
export function AuthCardHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.cardHead}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHead: { alignItems: 'center', gap: 6, marginBottom: theme.space.inlineHairline },
  cardTitle: { fontFamily: 'Cinzel-SemiBold', fontSize: 15, lineHeight: 22, letterSpacing: 1.5, color: theme.color.textPrimary, textAlign: 'center' },
  cardSubtitle: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, color: theme.color.textTertiary, textAlign: 'center' },
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
  copy: { alignItems: 'center' },
  eyebrow: { fontFamily: 'Cinzel-SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 3, textTransform: 'uppercase', color: theme.color.accentPrimary, textAlign: 'center' },
  textLeft: { textAlign: 'left' },
  copyDesktop: { alignItems: 'flex-start' },
  title: { marginTop: theme.space.inlineTight, marginBottom: theme.space.stackTight, textAlign: 'center', fontFamily: 'Cinzel-SemiBold', letterSpacing: 1, color: theme.color.textPrimary, fontSize: 28, lineHeight: 36 },
  titleDesktop: { textAlign: 'left', fontSize: 38, lineHeight: 48 },
  form: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingVertical: theme.space.sectionGap, paddingHorizontal: 28, borderRadius: theme.radius.panel, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard, shadowColor: theme.color.accentPrimary, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  formCompact: { paddingHorizontal: theme.space.stackDefault, paddingVertical: theme.space.cardInset },
  desktopForm: { flex: 0.95 },
  description: { maxWidth: 440, textAlign: 'center', fontSize: 14, lineHeight: 24 },
  descriptionDesktop: { textAlign: 'left' },
  quote: { maxWidth: 440, alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: theme.color.borderEmphasis, paddingLeft: theme.space.controlInset, gap: theme.space.inlineTight },
  quoteText: { fontFamily: 'Cinzel-SemiBold', fontSize: 13, lineHeight: 21, color: theme.color.accentHighlight },
  quoteSource: { fontFamily: 'Inter-Medium', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.color.textTertiary },
});
