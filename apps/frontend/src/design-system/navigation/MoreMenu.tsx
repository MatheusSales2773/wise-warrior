import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRuntimeMotionDuration } from '../components/motion-runtime';
import { WiseText } from '../components/WiseText';
import { controlStyles } from '../components/control-styles';
import { theme } from '../tokens/theme';
import { futureDestinations } from './destinations';
import { FutureDestinationRow } from './FutureDestinationRow';

type MoreMenuProps = {
  bottomInset: number;
  onClose: () => void;
  visible: boolean;
};

export function MoreMenu({ bottomInset, onClose, visible }: MoreMenuProps) {
  const motionDuration = useRuntimeMotionDuration();
  const [closeFocused, setCloseFocused] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [closePressed, setClosePressed] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <Modal
      animationType={modalAnimationType(motionDuration)}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      testID="more-modal"
      transparent
      visible
    >
      <View aria-modal accessibilityViewIsModal style={styles.overlay}>
        <Pressable
          accessibilityElementsHidden
          accessible={false}
          focusable={false}
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          testID="more-backdrop"
        />
        <View style={[styles.sheet, { paddingBottom: theme.space.controlInset + bottomInset }]} testID="more-sheet">
          <View style={styles.header}>
            <WiseText accessibilityRole="header" variant="title">
              Mais
            </WiseText>
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              onBlur={() => setCloseFocused(false)}
              onFocus={() => setCloseFocused(true)}
              onHoverIn={() => setCloseHovered(true)}
              onHoverOut={() => setCloseHovered(false)}
              onPress={onClose}
              onPressIn={() => setClosePressed(true)}
              onPressOut={() => setClosePressed(false)}
              style={[
                styles.close,
                (closeHovered || closePressed) && styles.closeInteracting,
                closeFocused && Platform.OS === 'web' && controlStyles.webFocus,
              ]}
            >
              <WiseText color="accentHighlight" variant="label">
                Fechar
              </WiseText>
            </Pressable>
          </View>
          {futureDestinations.map((destination) => (
            <FutureDestinationRow destination={destination} key={destination.label} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.color.backgroundOverlay,
  },
  sheet: {
    width: '100%',
    padding: theme.space.cardInset,
    backgroundColor: theme.color.backgroundRaised,
    borderColor: theme.color.borderEmphasis,
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
    borderWidth: theme.border.standard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space.stackDefault,
  },
  close: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.controlInset,
    borderRadius: theme.radius.control,
  },
  closeInteracting: { backgroundColor: theme.color.surfaceCardActive },
});

export function modalAnimationType(motionDuration: number): 'none' | 'slide' {
  return motionDuration === theme.motion.none ? 'none' : 'slide';
}
