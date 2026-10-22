import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WiseButton, WiseText, isDesktopLayout, theme } from '@/design-system';
import { useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';

/** What the dialog says for each way of ending a Study Session early; `action` is the label of the control that opened it. */
const COPY = {
  'Encerrar antecipadamente': {
    message: 'A sessão termina agora e você recebe XP proporcional ao foco válido até aqui.',
    confirm: 'Sim, encerrar',
  },
  'Cancelar sessão': {
    message: 'Com menos de 5 minutos de foco válido, cancelar não rende XP.',
    confirm: 'Sim, cancelar',
  },
} as const;

export type StopAction = keyof typeof COPY;

/** Asks before the Forja ends a Study Session; declining leaves it running and sends nothing. */
export function StopConfirmation({ action, onConfirm, onDecline }: { action: StopAction; onConfirm: () => void; onDecline: () => void }) {
  const motion = useRuntimeMotionDuration();
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const copy = COPY[action];

  return <Modal animationType={motion === theme.motion.none ? 'none' : desktop ? 'fade' : 'slide'} onRequestClose={onDecline} transparent visible testID="study-session-stop-modal">
    <View aria-modal accessibilityViewIsModal style={[styles.overlay, desktop ? styles.overlayCentered : styles.overlayBottom]}>
      <Pressable accessibilityElementsHidden accessible={false} focusable={false} importantForAccessibility="no-hide-descendants" onPress={onDecline} style={StyleSheet.absoluteFill} />
      <View accessibilityLabel={`Confirmar: ${action}`} role="dialog" style={desktop ? styles.dialog : styles.sheet} testID="study-session-stop-dialog">
        {desktop ? null : <View style={styles.grab} />}
        <WiseText variant="title">{action}?</WiseText>
        <WiseText color="textSecondary" variant="body">{copy.message}</WiseText>
        <View style={styles.actions}>
          <WiseButton label="Continuar sessão" onPress={onDecline} testID="study-session-stop-decline" variant="secondary" />
          <WiseButton label={copy.confirm} onPress={onConfirm} testID="study-session-stop-confirm" variant="danger" />
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(4, 4, 8, 0.74)' },
  overlayCentered: { alignItems: 'center', justifyContent: 'center', padding: theme.space.cardInset },
  overlayBottom: { justifyContent: 'flex-end' },
  dialog: {
    width: '100%', maxWidth: 452, gap: 16, padding: 28,
    borderRadius: theme.radius.panel, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
    ...theme.elevation.card,
  },
  sheet: {
    width: '100%', gap: 16, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.color.borderEmphasis },
  actions: { gap: 12 },
});
