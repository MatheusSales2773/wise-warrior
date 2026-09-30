import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { motionDuration, theme } from '../tokens/theme';
import { useReducedMotion } from './motion-runtime';

export type ProgressBarProps = {
  minimumValue?: number;
  maximumValue?: number;
  accessibilityLabel?: string;
  testID?: string;
  /** `tall` matches the framed prototype bar: inset track, hairline border and gold gradient fill. */
  size?: 'default' | 'tall';
} & ({ indeterminate: true; value?: never } | { indeterminate?: false; value: number });

export function ProgressBar({ minimumValue = 0, maximumValue = 100, value, indeterminate = false, accessibilityLabel, testID, size = 'default' }: ProgressBarProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const duration = motionDuration(theme.motion.deliberate, useReducedMotion());

  useEffect(() => {
    opacity.setValue(1);
    // Do not start a zero-duration loop when motion is disabled.
    if (!indeterminate || duration === 0) return;
    // React Native's test renderer has no native view to attach the driver to.
    const useNativeDriver = process.env.NODE_ENV !== 'test';
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: theme.progress.indeterminateDimOpacity, duration, useNativeDriver, isInteraction: false }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver, isInteraction: false }),
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
      style={[styles.track, size === 'tall' && styles.tallTrack]}
    >
      <Animated.View
        testID={testID ? `${testID}-fill` : undefined}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.fill, size === 'tall' && styles.tallFill, { width: indeterminate ? theme.progress.indeterminateWidth : `${fraction * 100}%`, opacity: indeterminate && duration > 0 ? opacity : 1 }]}
      >
        {size === 'tall' ? <LinearGradient colors={[theme.color.accentMuted, theme.color.accentPrimary]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: theme.space.inlineTight, overflow: 'hidden', borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceCard },
  tallTrack: { height: 12, borderRadius: 2, borderWidth: theme.border.standard, borderColor: theme.color.borderSoft, backgroundColor: theme.color.surfaceInset },
  tallFill: { borderRadius: 0, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.color.accentPrimary },
});
