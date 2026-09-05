import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isDesktopLayout } from '../tokens/layout';
import { theme } from '../tokens/theme';

export function Screen({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopLayout(Platform.OS, width);
  const horizontalGutter = desktop
    ? theme.layout.wideWebGutter
    : Platform.OS === 'web'
      ? theme.layout.narrowWebGutter
      : theme.layout.mobileGutter;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[theme.color.backgroundCanvas, theme.color.backgroundRaised, theme.color.backgroundOverlay]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.centeringFrame}>
        <View
          testID="screen-content"
          style={[
            styles.content,
            { paddingHorizontal: horizontalGutter },
            desktop ? styles.desktopContent : styles.mobileContent,
          ]}
        >
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.backgroundCanvas },
  centeringFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopContent: { minHeight: 560 },
  mobileContent: { minHeight: 440 },
});
