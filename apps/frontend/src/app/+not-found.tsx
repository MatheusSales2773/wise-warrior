import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFontFallback } from '@/design-system/components/font-runtime';
import { Screen } from '@/design-system/components/screen';
import { BrandSigil } from '@/design-system/icons/brand-sigil';
import { theme, typographyFor } from '@/design-system/tokens/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  const useFallback = useFontFallback();

  return (
    <Screen>
      <View style={styles.panel}>
        <View style={styles.sigil}>
          <BrandSigil />
        </View>
        <Text style={[typographyFor('mono', useFallback), styles.code]}>RUNA 404</Text>
        <Text accessibilityRole="header" style={[typographyFor('title', useFallback), styles.title]}>
          Página não encontrada
        </Text>
        <Text style={[typographyFor('body', useFallback), styles.description]}>
          Este caminho não pertence ao mapa.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          onPress={() => router.replace('/')}
          style={styles.button}
        >
          <Text style={[typographyFor('label', useFallback), styles.buttonLabel]}>Voltar ao início</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: theme.space.screenGap,
    backgroundColor: theme.color.surfaceCard,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.panel,
    borderWidth: theme.border.standard,
  },
  sigil: {
    position: 'absolute',
    opacity: 0.28,
  },
  code: {
    color: theme.color.accentMuted,
    letterSpacing: 2,
    marginBottom: theme.space.stackDefault,
  },
  title: {
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
  description: {
    color: theme.color.textSecondary,
    marginTop: theme.space.inlineTight,
    textAlign: 'center',
  },
  button: {
    marginTop: theme.space.sectionGap,
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.cardInset,
    backgroundColor: theme.color.surfaceInset,
    borderColor: theme.color.borderEmphasis,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
  },
  buttonLabel: {
    color: theme.color.accentHighlight,
  },
});
