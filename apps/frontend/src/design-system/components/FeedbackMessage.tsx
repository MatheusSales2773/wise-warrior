import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { theme, type SemanticColor } from '../tokens/theme';
import { WiseText } from './WiseText';

export type FeedbackMessageVariant = 'info' | 'success' | 'warning' | 'error';
export type FeedbackMessageProps = {
  variant: FeedbackMessageVariant;
  message: string;
  title?: string;
  nativeID?: string;
  testID?: string;
};

const variants = {
  info: { icon: 'ℹ', color: 'feedbackInfo' },
  success: { icon: '✓', color: 'feedbackSuccess' },
  warning: { icon: '!', color: 'accentPrimary' },
  error: { icon: '×', color: 'feedbackDanger' },
} satisfies Record<FeedbackMessageVariant, { icon: string; color: SemanticColor }>;

export function FeedbackMessage({ variant, message, title, nativeID, testID }: FeedbackMessageProps) {
  const { icon, color } = variants[variant];
  const urgent = variant === 'error';
  const announcement = title ? `${title}. ${message}` : message;

  useEffect(() => {
    // Native live regions are Android-only; VoiceOver needs the announcement API.
    if (Platform.OS === 'ios' && announcement) {
      AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: !urgent });
    }
  }, [announcement, urgent]);

  return (
    <View
      nativeID={nativeID}
      testID={testID}
      accessible
      accessibilityLabel={announcement}
      accessibilityRole={urgent ? 'alert' : undefined}
      accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
      aria-live={urgent ? 'assertive' : 'polite'}
      style={[styles.message, { borderColor: theme.color[color] }]}
    >
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <WiseText variant="body" color={color}>{icon}</WiseText>
      </View>
      <View style={styles.content}>
        {title ? <WiseText variant="label">{title}</WiseText> : null}
        <WiseText variant="body">{message}</WiseText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.inlineTight,
    padding: theme.space.inlineTight,
    borderWidth: theme.border.standard,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.surfaceInset,
  },
  content: { flex: 1, minWidth: 0 },
});
