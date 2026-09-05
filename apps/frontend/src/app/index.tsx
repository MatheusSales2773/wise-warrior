import { StyleSheet, Text, View } from 'react-native';
import { useFontFallback } from '@/design-system/components/font-runtime';
import { Screen } from '@/design-system/components/screen';
import { BrandSigil } from '@/design-system/icons/brand-sigil';
import { theme, typographyFor } from '@/design-system/tokens/theme';

export default function HomeScreen() {
  const useFallback = useFontFallback();

  return (
    <Screen>
      <View style={styles.sigil}>
        <BrandSigil />
      </View>
      <View style={styles.copy}>
        <Text style={[typographyFor('caption', useFallback), styles.eyebrow]}>FUNDAÇÃO UNIVERSAL</Text>
        <Text accessibilityRole="header" style={[typographyFor('display', useFallback), styles.title]}>
          Wise Warrior
        </Text>
        <View style={styles.rule} />
        <Text style={[typographyFor('subtitleStrong', useFallback), styles.status]}>Fundação universal ativa</Text>
        <Text style={[typographyFor('monoEmphasis', useFallback), styles.signature]}>OURO · ÍNDIGO</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sigil: {
    position: 'absolute',
    opacity: 0.72,
  },
  copy: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.pageGap,
  },
  eyebrow: {
    color: theme.color.accentMuted,
    letterSpacing: 2,
    marginBottom: theme.space.stackTight,
  },
  title: {
    color: theme.color.textPrimary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  rule: {
    width: 48,
    height: theme.border.standard,
    marginVertical: theme.space.stackDefault,
    backgroundColor: theme.color.accentPrimary,
  },
  status: {
    color: theme.color.textSecondary,
    textAlign: 'center',
  },
  signature: {
    color: theme.color.textTertiary,
    letterSpacing: 1.5,
    marginTop: theme.space.sectionGap,
  },
});
