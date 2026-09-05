import { StyleSheet, View } from 'react-native';
import { theme } from '../tokens/theme';
import { WiseText } from '../components/WiseText';
import type { FutureDestination } from './destinations';

export function FutureDestinationRow({ destination }: { destination: FutureDestination }) {
  return (
    <View
      accessibilityLabel={`${destination.label}, indisponível, em breve`}
      accessibilityState={{ disabled: true }}
      accessible
      focusable={false}
      style={styles.row}
    >
      <WiseText color="textSecondary" variant="label">
        {destination.label}
      </WiseText>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.badge}>
        <WiseText color="accentPrimary" variant="caption">
          Em breve
        </WiseText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.inlineTight,
    paddingVertical: theme.space.inlineTight,
    paddingHorizontal: theme.space.controlInset,
  },
  badge: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.standard,
    paddingHorizontal: theme.space.inlineTight,
    paddingVertical: theme.space.inlineHairline,
  },
});
