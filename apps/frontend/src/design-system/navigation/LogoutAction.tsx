import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { logoutErrorMessage } from '@/features/auth/messages';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { WiseButton } from '../components/WiseButton';
import { theme } from '../tokens/theme';

type LogoutActionProps = {
  onLogout: () => Promise<void>;
};

export function LogoutAction({ onLogout }: LogoutActionProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pendingRef = useRef(false);

  const submit = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [onLogout]);

  return (
    <View style={styles.container} testID="logout-action">
      <WiseButton accessibilityLabel="Sair" label="Sair" loading={pending} onPress={submit} testID="logout-button" variant="danger" />
      {error !== null && (
        <View style={styles.error}>
          <FeedbackMessage message={logoutErrorMessage(error)} testID="logout-error" title="Erro ao sair" variant="error" />
          <WiseButton accessibilityLabel="Tentar novamente" label="Tentar novamente" onPress={submit} testID="logout-retry" variant="ghost" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.space.inlineTight },
  error: { gap: theme.space.inlineHairline },
});
