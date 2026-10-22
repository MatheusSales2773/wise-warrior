import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../tokens/theme';
import { useRuntimeMotionDuration } from './motion-runtime';

export type WiseDialogProps = {
  accessibilityLabel: string;
  children: ReactNode;
  /** Centered card on desktop, bottom sheet on phones. */
  desktop: boolean;
  /** Backdrop tap, Escape on web and the Android back button. */
  onClose: () => void;
  testID: string;
};

/** Modal frame shared by the confirmations: backdrop, centered card or bottom sheet, and the motion that goes with each. */
export function WiseDialog({ accessibilityLabel, children, desktop, onClose, testID }: WiseDialogProps) {
  const motion = useRuntimeMotionDuration();
  return <Modal animationType={motion === theme.motion.none ? 'none' : desktop ? 'fade' : 'slide'} onRequestClose={onClose} transparent visible testID={`${testID}-modal`}>
    <View aria-modal accessibilityViewIsModal style={[styles.overlay, desktop ? styles.overlayCentered : styles.overlayBottom]}>
      <Pressable accessibilityElementsHidden accessible={false} focusable={false} importantForAccessibility="no-hide-descendants" onPress={onClose} style={StyleSheet.absoluteFill} testID={`${testID}-backdrop`} />
      <View accessibilityLabel={accessibilityLabel} role="dialog" style={desktop ? styles.dialog : styles.sheet} testID={testID}>
        {desktop ? null : <View style={styles.grab} />}
        {children}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.backdrop },
  overlayCentered: { alignItems: 'center', justifyContent: 'center', padding: theme.space.cardInset },
  overlayBottom: { justifyContent: 'flex-end' },
  dialog: {
    width: '100%', maxWidth: 452, gap: 20, padding: 28,
    borderRadius: theme.radius.panel, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
    ...theme.elevation.card,
  },
  sheet: {
    width: '100%', gap: 16, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: theme.border.standard, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceCard,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.color.borderEmphasis },
});
