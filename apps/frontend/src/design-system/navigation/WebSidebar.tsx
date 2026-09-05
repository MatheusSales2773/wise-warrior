import { StyleSheet, View } from 'react-native';
import { BrandSigil } from '../icons/brand-sigil';
import { theme } from '../tokens/theme';
import { WiseText } from '../components/WiseText';
import { futureDestinations, isDestinationActive, primaryDestinations } from './destinations';
import { FutureDestinationRow } from './FutureDestinationRow';
import { NavigationLink } from './NavigationLink';

export function WebSidebar({ pathname }: { pathname: string }) {
  return (
    <View accessibilityLabel="Navegação principal" style={styles.sidebar} testID="web-sidebar">
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={styles.brand}>
        <BrandSigil size={32} />
        <WiseText color="accentHighlight" variant="subtitle">
          Wise Warrior
        </WiseText>
      </View>
      <View style={styles.primary}>
        {primaryDestinations.map((destination) => (
          <NavigationLink active={isDestinationActive(destination, pathname)} destination={destination} key={destination.href} />
        ))}
      </View>
      <View style={styles.future}>
        {futureDestinations.map((destination) => (
          <FutureDestinationRow destination={destination} key={destination.label} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: theme.layout.sidebarWidth,
    padding: theme.space.cardInset,
    backgroundColor: theme.color.backgroundRaised,
    borderRightColor: theme.color.borderSubtle,
    borderRightWidth: theme.border.standard,
  },
  brand: {
    minHeight: theme.layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.stackTight,
    marginBottom: theme.space.screenGap,
  },
  primary: { gap: theme.space.inlineTight },
  future: {
    marginTop: 'auto',
    gap: theme.space.inlineHairline,
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: theme.border.standard,
    paddingTop: theme.space.stackDefault,
  },
});
