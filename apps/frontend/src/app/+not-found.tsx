import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, WiseCard, WiseIcon, WiseText, theme } from '@/design-system';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen title="Página não encontrada">
      <WiseCard style={styles.panel} variant="ornamented">
        <View style={styles.panelContent}>
          <WiseIcon color="accentMuted" name="shield-outline" size="large" />
          <WiseText color="accentPrimary" style={styles.code} variant="mono">
            RUNA 404
          </WiseText>
          <WiseText color="textSecondary" style={styles.description} variant="body">
            Este caminho não pertence ao mapa.
          </WiseText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao início"
            onPress={() => router.replace('/')}
            style={styles.button}
          >
            <WiseText color="accentHighlight" variant="label">Voltar ao início</WiseText>
          </Pressable>
        </View>
      </WiseCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  panelContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.screenGap,
  },
  code: {
    marginBottom: theme.space.stackDefault,
  },
  description: {
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
});
