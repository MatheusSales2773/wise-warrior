import type { UseQueryResult } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '@/design-system';
import type { DeviceSession } from '@/features/profile/api';
import { DevicesContent } from '@/features/profile/devices-tab';
import { CharacterModal, usePanelStyle, type EquipmentPanelVariant } from './equipment-drawer';

/** Opened from the "Dispositivos conectados" row; lists the sessions and ends one or all of them (ADR-009). */
export function DevicesPanel({ currentSessionId, onClose, query, variant }: {
  currentSessionId: string | null;
  onClose: () => void;
  query: UseQueryResult<DeviceSession[]>;
  variant: EquipmentPanelVariant;
}) {
  const panelStyle = usePanelStyle(variant);
  return <CharacterModal onClose={onClose} testID="devices-modal" variant={variant}>
    <ScrollView
      accessibilityLabel="Dispositivos conectados"
      accessibilityViewIsModal
      aria-modal
      contentContainerStyle={styles.content}
      role="dialog"
      style={[panelStyle, styles.panel]}
      testID="devices-panel"
    >
      <Pressable accessibilityLabel="Fechar" accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.close}>
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>
      <DevicesContent currentSessionId={currentSessionId} query={query} />
    </ScrollView>
  </CharacterModal>;
}

const styles = StyleSheet.create({
  panel: { flexGrow: 0 },
  content: { gap: theme.space.stackDefault },
  close: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.detail, borderWidth: theme.border.standard, borderColor: theme.color.borderEmphasis },
  closeGlyph: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 17, color: theme.color.textSecondary },
});
