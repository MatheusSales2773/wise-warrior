import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { WiseIcon } from '../icons/WiseIcon';
import { theme } from '../tokens/theme';
import { controlStyles } from '../components/control-styles';
import { WiseText } from '../components/WiseText';
import type { PrimaryDestination } from './destinations';

type NavigationLinkProps = {
  active: boolean;
  compact?: boolean;
  destination: PrimaryDestination;
};

export function NavigationLink({ active, compact = false, destination }: NavigationLinkProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link asChild href={destination.href}>
      <Pressable
        accessibilityLabel={destination.label}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.target,
          compact ? styles.compact : styles.wide,
          active && styles.active,
          (hovered || pressed) && !active && styles.interacting,
          focused && Platform.OS === 'web' && controlStyles.webFocus,
        ])}
      >
        <WiseIcon color={active ? 'accentHighlight' : 'textTertiary'} name={active ? destination.activeIcon : destination.inactiveIcon} />
        <WiseText
          color={active ? 'accentHighlight' : 'textSecondary'}
          numberOfLines={compact ? 2 : 1}
          style={compact ? styles.compactLabel : undefined}
          variant="label"
        >
          {destination.label}
        </WiseText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  target: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
  },
  wide: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.space.stackTight,
    paddingHorizontal: theme.space.controlInset,
  },
  compact: {
    flex: 1,
    paddingHorizontal: theme.space.inlineHairline,
    paddingVertical: theme.space.inlineHairline,
  },
  compactLabel: { width: '100%', textAlign: 'center' },
  active: {
    backgroundColor: theme.color.surfaceCardActive,
    borderColor: theme.color.borderEmphasis,
  },
  interacting: {
    backgroundColor: theme.color.surfaceCard,
    borderColor: theme.color.borderEmphasis,
  },
});
