import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { motionDuration, theme } from '../tokens/theme';
import { useReducedMotion } from './motion-runtime';

export type ProgressBarProps = {
  minimumValue?: number;
  maximumValue?: number;
  accessibilityLabel?: string;
  testID?: string;
} & ({ indeterminate: true; value?: never } | { indeterminate?: false; value: number });

export function ProgressBar({ minimumValue = 0, maximumValue = 100, value, indeterminate = false, accessibilityLabel, testID }: ProgressBarProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const duration = motionDuration(theme.motion.deliberate, useReducedMotion());

  useEffect(() => {
    opacity.setValue(1);
    // Do not start a zero-duration loop when motion is disabled.
    if (!indeterminate || duration === 0) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: theme.progress.indeterminateDimOpacity, duration, useNativeDriver: true, isInteraction: false }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [duration, indeterminate, opacity]);

  if (__DEV__ && minimumValue >= maximumValue) {
    throw new Error('ProgressBar minimumValue must be less than maximumValue.');
  }
  const fraction = maximumValue > minimumValue
    ? Math.max(0, Math.min(1, ((value ?? minimumValue) - minimumValue) / (maximumValue - minimumValue)))
    : 0;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={indeterminate ? { min: minimumValue, max: maximumValue } : { min: minimumValue, max: maximumValue, now: value }}
      accessibilityState={{ busy: indeterminate }}
      aria-valuemin={minimumValue}
      aria-valuemax={maximumValue}
      aria-valuenow={indeterminate ? undefined : value}
      aria-busy={indeterminate}
      style={styles.track}
    >
      <Animated.View
        testID={testID ? `${testID}-fill` : undefined}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.fill, { width: indeterminate ? theme.progress.indeterminateWidth : `${fraction * 100}%`, opacity: indeterminate && duration > 0 ? opacity : 1 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: theme.space.inlineTight, overflow: 'hidden', borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceCard },
  fill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.color.accentPrimary },
});
