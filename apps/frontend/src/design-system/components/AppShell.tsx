import { usePathname } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { isDesktopLayout } from '../tokens/layout';
import { theme } from '../tokens/theme';
import { AppNavigation } from './AppNavigation';

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = isDesktopLayout(Platform.OS, width);
  return (
    <AppShellFrame insets={insets} isDesktop={isDesktop} pathname={pathname}>
      {children}
    </AppShellFrame>
  );
}

type AppShellFrameProps = PropsWithChildren<{
  insets: EdgeInsets;
  isDesktop: boolean;
  pathname: string;
}>;

export function AppShellFrame({ children, insets, isDesktop, pathname }: AppShellFrameProps) {
  const [navigationState, setNavigationState] = useState({ isDesktop, modalVisible: false });
  if (navigationState.isDesktop !== isDesktop) {
    setNavigationState({ isDesktop, modalVisible: false });
  }
  const modalVisible = navigationState.isDesktop === isDesktop && navigationState.modalVisible;
  const bottomReservation = isDesktop ? 0 : theme.layout.bottomNavigationHeight + insets.bottom;

  return (
    <View style={[styles.shell, { paddingTop: insets.top, paddingRight: insets.right, paddingLeft: insets.left }]}>
      <View
        aria-hidden={modalVisible}
        accessibilityElementsHidden={modalVisible}
        importantForAccessibility={modalVisible ? 'no-hide-descendants' : 'auto'}
        style={[
          styles.routeContent,
          {
            marginLeft: isDesktop ? theme.layout.sidebarWidth : 0,
            paddingBottom: bottomReservation,
            pointerEvents: modalVisible ? 'none' : 'auto',
          },
        ]}
        testID="app-route-content"
      >
        {children}
      </View>
      <AppNavigation
        bottomInset={insets.bottom}
        isDesktop={isDesktop}
        modalVisible={modalVisible}
        onModalVisibilityChange={(visible) => setNavigationState({ isDesktop, modalVisible: visible })}
        pathname={pathname}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  routeContent: { flex: 1 },
});
