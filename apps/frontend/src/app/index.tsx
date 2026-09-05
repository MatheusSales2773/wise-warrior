import { StyleSheet, View } from 'react-native';
import { Screen, WiseCard, WiseIcon, WiseText, theme } from '@/design-system';

export default function HomeScreen() {
  return (
    <Screen title="Wise Warrior" titleVariant="display">
      <WiseCard style={styles.card} variant="ornamented">
        <View style={styles.copy}>
          <WiseIcon color="accentMuted" name="shield-outline" size="large" />
          <WiseText color="accentMuted" style={styles.eyebrow} variant="caption">
            FUNDAÇÃO UNIVERSAL
          </WiseText>
          <View style={styles.rule} />
          <WiseText color="textSecondary" style={styles.status} variant="subtitle">
            Fundação universal ativa
          </WiseText>
          <WiseText color="textTertiary" style={styles.signature} variant="mono">
            OURO · ÍNDIGO
          </WiseText>
        </View>
      </WiseCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  copy: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.pageGap,
  },
  eyebrow: {
    marginBottom: theme.space.stackTight,
  },
  rule: {
    width: theme.space.heroGap,
    height: theme.border.standard,
    marginVertical: theme.space.stackDefault,
    backgroundColor: theme.color.accentPrimary,
  },
  status: {
    textAlign: 'center',
  },
  signature: {
    marginTop: theme.space.sectionGap,
  },
});
