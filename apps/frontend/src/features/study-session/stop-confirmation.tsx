import type { StudySessionKind } from './focus-choice';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WiseButton, WiseDialog, WiseText, isDesktopLayout } from '@/design-system';

/** Below this much valid focus a stop is a Cancelamento (no XP); from it on, an Encerramento antecipado. */
export const EARLY_STOP_MIN_SECONDS = 300;

export type StopKind = 'cancel' | 'early-end' | 'free-end';

/** A Foco livre has no planned end, so stopping it from 5 minutes on is concluding it, not ending early. */
export function stopKindFor(validFocusSeconds: number, sessionKind: StudySessionKind = 'cycle'): StopKind {
  if (validFocusSeconds < EARLY_STOP_MIN_SECONDS) return 'cancel';
  return sessionKind === 'free' ? 'free-end' : 'early-end';
}

/** What the Forja calls each way of ending a Study Session early, on its control and in the dialog that asks first. */
export const STOP_COPY = {
  'early-end': {
    label: 'Encerrar antecipadamente',
    message: 'A sessão termina agora e você recebe XP proporcional ao foco válido até aqui.',
    confirm: 'Sim, encerrar',
  },
  'free-end': {
    label: 'Parar foco livre',
    message: 'O foco livre termina agora e você recebe XP proporcional ao foco válido.',
    confirm: 'Sim, parar',
  },
  cancel: {
    label: 'Cancelar sessão',
    message: `Com menos de ${EARLY_STOP_MIN_SECONDS / 60} minutos de foco válido, cancelar não rende XP.`,
    confirm: 'Sim, cancelar',
  },
} as const satisfies Record<StopKind, { label: string; message: string; confirm: string }>;

/** Asks before the Forja ends a Study Session; declining leaves it running and sends nothing. */
export function StopConfirmation({ kind, onConfirm, onDecline }: { kind: StopKind; onConfirm: () => void; onDecline: () => void }) {
  const { width } = useWindowDimensions();
  const copy = STOP_COPY[kind];

  return <WiseDialog accessibilityLabel={`Confirmar: ${copy.label}`} desktop={isDesktopLayout(Platform.OS, width)} onClose={onDecline} testID="study-session-stop-dialog">
    <WiseText variant="title">{copy.label}?</WiseText>
    <WiseText color="textSecondary" variant="body">{copy.message}</WiseText>
    <View style={styles.actions}>
      <WiseButton label="Continuar sessão" onPress={onDecline} testID="study-session-stop-decline" variant="secondary" />
      <WiseButton label={copy.confirm} onPress={onConfirm} testID="study-session-stop-confirm" variant="danger" />
    </View>
  </WiseDialog>;
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
});
