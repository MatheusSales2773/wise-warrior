import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import { WiseIcon } from '../icons/WiseIcon';
import { theme } from '../tokens/theme';
import { controlStyles } from '../components/control-styles';
import { WiseText } from '../components/WiseText';
import { isDestinationActive, primaryDestinations } from './destinations';
import { NavigationLink } from './NavigationLink';

type MobileNavigationProps = {
  bottomInset: number;
  hiddenForModal: boolean;
  moreActive: boolean;
  onOpenMore: () => void;
  pathname: string;
};

export const MobileNavigation = forwardRef<ViewType, MobileNavigationProps>(function MobileNavigation(
  { bottomInset, hiddenForModal, moreActive, onOpenMore, pathname },
  ref,
) {
  const [moreFocused, setMoreFocused] = useState(false);
  const [moreHovered, setMoreHovered] = useState(false);
  const [morePressed, setMorePressed] = useState(false);

  return (
    <View
      aria-hidden={hiddenForModal}
      accessibilityElementsHidden={hiddenForModal}
      accessibilityLabel="Navegação principal"
      importantForAccessibility={hiddenForModal ? 'no-hide-descendants' : 'auto'}
      style={[styles.navigation, { height: theme.layout.bottomNavigationHeight + bottomInset, paddingBottom: bottomInset }]}
      testID="mobile-navigation"
    >
      {primaryDestinations.map((destination) => (
        <NavigationLink active={isDestinationActive(destination, pathname)} compact destination={destination} key={destination.href} />
      ))}
      <Pressable
        accessibilityLabel="Mais"
        accessibilityRole="button"
        onBlur={() => setMoreFocused(false)}
        onFocus={() => setMoreFocused(true)}
        onHoverIn={() => setMoreHovered(true)}
        onHoverOut={() => setMoreHovered(false)}
        onPress={onOpenMore}
        onPressIn={() => setMorePressed(true)}
        onPressOut={() => setMorePressed(false)}
        ref={ref}
        style={[
          styles.more,
          (moreHovered || morePressed) && styles.moreInteracting,
          moreFocused && Platform.OS === 'web' && controlStyles.webFocus,
        ]}
      >
        <WiseIcon
          color={moreActive ? 'accentHighlight' : 'textTertiary'}
          name={moreActive ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
          testID="more-navigation-icon"
        />
        <WiseText color={moreActive ? 'accentHighlight' : 'textSecondary'} style={styles.label} variant="label">
          Mais
        </WiseText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  navigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.color.backgroundRaised,
    borderTopColor: theme.color.borderEmphasis,
    borderTopWidth: theme.border.standard,
    paddingHorizontal: theme.space.inlineHairline,
  },
  more: {
    flex: 1,
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    borderRadius: theme.radius.control,
    borderWidth: theme.border.standard,
    paddingHorizontal: theme.space.inlineHairline,
    paddingVertical: theme.space.inlineHairline,
  },
  label: { width: '100%', textAlign: 'center' },
  moreInteracting: { backgroundColor: theme.color.surfaceCard, borderColor: theme.color.borderEmphasis },
});
