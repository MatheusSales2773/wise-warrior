import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { theme } from '../tokens/theme';

export type WiseCardVariant = 'default' | 'elevated' | 'ornamented';

export type WiseCardProps = Omit<ViewProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  variant?: WiseCardVariant;
};

export function WiseCard({ children, style, variant = 'default', ...viewProps }: PropsWithChildren<WiseCardProps>) {
  return (
    <View
      {...viewProps}
      style={[styles.card, variant === 'default' && styles.defaultCard, variant === 'elevated' && styles.elevatedCard, style]}
    >
      {variant === 'ornamented' && (
        <LinearGradient
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={[theme.color.accentMuted, theme.color.accentPrimary, theme.color.accentHighlight]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          testID={viewProps.testID ? `${viewProps.testID}-ornament` : 'wise-card-ornament'}
        />
      )}
      {variant === 'ornamented' ? <View style={styles.ornamentContent}>{children}</View> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    backgroundColor: theme.color.surfaceCard,
  },
  defaultCard: {
    borderColor: theme.color.borderSoft,
    borderWidth: theme.border.standard,
  },
  elevatedCard: {
    backgroundColor: theme.color.surfaceElevated,
    ...theme.elevation.card,
  },
  ornamentContent: {
    flexGrow: 1,
    margin: theme.border.standard,
    borderRadius: theme.radius.detail,
    backgroundColor: theme.color.surfaceCard,
  },
});
