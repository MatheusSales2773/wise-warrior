import { StyleSheet, View } from 'react-native';
import { FeedbackMessage, ProgressBar, Screen, WiseButton, WiseText, theme } from '@/design-system';

/** Gate local exibido enquanto a Session é verificada, sem piscar rota alguma. */
export function SessionRestoringScreen() {
  return (
    <Screen scrollable={false} testID="session-restoring" title="Restaurando sessão">
      <View accessible accessibilityLiveRegion="polite" style={styles.panel}>
        <WiseText color="textSecondary" variant="body">
          Verificando sua sessão segura…
        </WiseText>
        <ProgressBar accessibilityLabel="Restaurando sessão" indeterminate />
      </View>
    </Screen>
  );
}

export function SessionUnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen testID="session-unavailable" title="Não foi possível verificar sua sessão">
      <View style={styles.panel}>
        <FeedbackMessage
          message="Não foi possível verificar sua sessão agora. Tente novamente; sua sessão será preservada."
          title="Instabilidade temporária"
          variant="warning"
        />
        <WiseButton label="Tentar novamente" onPress={onRetry} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { gap: theme.space.stackDefault },
});
