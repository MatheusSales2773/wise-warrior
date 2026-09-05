import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { screenGutter } from '../tokens/layout';
import { theme } from '../tokens/theme';
import { WiseText, type WiseTextVariant } from './WiseText';

export type ScreenProps = {
  avoidKeyboard?: boolean;
  children?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  hasBottomNavigation?: boolean;
  keyboardVerticalOffset?: number;
  scrollable?: boolean;
  safeAreaEdges?: Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  titleVariant?: WiseTextVariant;
};

const DEFAULT_SAFE_AREA_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
const BOTTOM_NAVIGATION_SAFE_AREA_EDGES: Edge[] = ['top', 'right', 'left'];

export function Screen({
  avoidKeyboard = false,
  children,
  contentContainerStyle,
  contentStyle,
  hasBottomNavigation = false,
  keyboardVerticalOffset = 0,
  scrollable = true,
  safeAreaEdges,
  style,
  testID,
  title,
  titleVariant = 'title',
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalGutter = screenGutter(Platform.OS, width);
  const edges = safeAreaEdges ?? (hasBottomNavigation ? BOTTOM_NAVIGATION_SAFE_AREA_EDGES : DEFAULT_SAFE_AREA_EDGES);
  const content = (
    <View
      testID={testID ? `${testID}-content` : 'screen-content'}
      style={[styles.content, { paddingHorizontal: horizontalGutter }, contentStyle]}
    >
      <WiseText accessibilityRole="header" style={styles.title} testID={testID ? `${testID}-title` : 'screen-title'} variant={titleVariant}>
        {title}
      </WiseText>
      {children}
    </View>
  );

  const body = scrollable ? (
    <ScrollView
      automaticallyAdjustContentInsets={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      style={styles.flex}
      testID={testID ? `${testID}-scroll` : 'screen-scroll'}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={styles.staticContent} testID={testID ? `${testID}-static-content` : 'screen-static-content'}>
      {content}
    </View>
  );

  const shouldAvoidKeyboard = avoidKeyboard && Platform.OS !== 'web';

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]} testID={testID ? `${testID}-safe-area` : 'screen-safe-area'}>
      <LinearGradient
        colors={[theme.color.backgroundCanvas, theme.color.backgroundRaised, theme.color.backgroundOverlay]}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {shouldAvoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          enabled
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.flex}
          testID={testID ? `${testID}-keyboard-avoider` : 'screen-keyboard-avoider'}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.backgroundCanvas,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.heroGap,
  },
  staticContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignItems: 'stretch',
  },
  title: {
    width: '100%',
    marginBottom: theme.space.sectionGap,
    textAlign: 'center',
  },
});
