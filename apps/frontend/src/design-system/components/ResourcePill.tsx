import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { theme } from '../tokens/theme';
import { WiseText } from './WiseText';

export type ResourcePillProps = {
  label: string;
  icon?: ReactNode;
  testID?: string;
} & (
  | { onPress: NonNullable<PressableProps['onPress']>; accessibilityLabel: string }
  | { onPress?: never; accessibilityLabel?: never }
);

export function ResourcePill({ label, icon, onPress, accessibilityLabel, testID }: ResourcePillProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  if (onPress && !accessibilityLabel?.trim()) {
    throw new Error('Interactive ResourcePill requires an accessible label.');
  }

  const content = <>
    {icon != null && <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{icon}</View>}
    <WiseText variant="label">{label}</WiseText>
  </>;

  if (!onPress) return <View testID={testID} style={styles.pill}>{content}</View>;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.pill, styles.interactive, (hovered || pressed) && styles.active, focused && Platform.OS === 'web' && styles.focus]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.space.inlineTight,
    paddingHorizontal: theme.space.stackTight,
    paddingVertical: theme.space.inlineHairline,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.standard,
    borderColor: theme.color.borderEmphasis,
    backgroundColor: theme.color.surfaceCard,
  },
  interactive: { minHeight: theme.layout.touchTarget, minWidth: theme.layout.touchTarget },
  active: { backgroundColor: theme.color.surfaceCardActive, borderColor: theme.color.accentPrimary },
  focus: { outlineWidth: theme.border.focus, outlineStyle: 'solid', outlineColor: theme.color.accentPrimary },
});
