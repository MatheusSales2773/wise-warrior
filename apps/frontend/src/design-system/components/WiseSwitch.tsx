import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, type AccessibilityRole } from 'react-native';
import { theme } from '../tokens/theme';
import { controlStyles } from './control-styles';
import { useReducedMotion } from './motion-runtime';
import { motionDuration } from '../tokens/theme';

export type WiseSwitchProps = {
  /** Names the switch for assistive technology; the visible title beside it is not linked to it. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
};

const WIDTH = 44;
const HEIGHT = 26;
const KNOB = 20;
const KNOB_INSET = 3;
const BORDER = 1;

/**
 * Figma "Switch/on" and "Switch/off": a 44×26 pill with a 20 px knob, 3 px from the edge on the side it rests.
 * The knob and colors slide between the two states in `motion.quick`, and jump when reduce motion is on.
 */
export function WiseSwitch({ accessibilityHint, accessibilityLabel, onValueChange, testID, value }: WiseSwitchProps) {
  const [focused, setFocused] = useState(false);
  // 0 is off, 1 is on; the first render rests at the current value without animating.
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const duration = motionDuration(theme.motion.quick, useReducedMotion());

  const shown = useRef(value);

  useEffect(() => {
    // The reduce-motion preference settling must not replay a move that already happened.
    if (shown.current === value) return;
    shown.current = value;
    if (duration === 0) {
      progress.setValue(value ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, { toValue: value ? 1 : 0, duration, useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [duration, progress, value]);

  const mix = (off: string, on: string) => progress.interpolate({ inputRange: [0, 1], outputRange: [off, on] });

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={'switch' as AccessibilityRole}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      hitSlop={(theme.layout.touchTarget - HEIGHT) / 2}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => onValueChange(!value)}
      role="switch"
      style={[styles.switch, focused && Platform.OS === 'web' && controlStyles.webFocus]}
      testID={testID}
    >
      <Animated.View
        style={[styles.track, {
          backgroundColor: mix(theme.color.surfaceInset, theme.color.accentPrimary),
          borderColor: mix(theme.color.borderEmphasis, theme.color.accentPrimary),
        }]}
        testID={testID ? `${testID}-track` : undefined}
      >
        <Animated.View
          style={[styles.knob, {
            backgroundColor: mix(theme.color.textTertiary, theme.color.backgroundCanvas),
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [KNOB_INSET - BORDER, WIDTH - KNOB_INSET - KNOB - BORDER] }),
          }]}
          testID={testID ? `${testID}-knob` : undefined}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switch: { width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2 },
  track: { width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2, borderWidth: BORDER },
  // Positions are relative to the padding box, inside the 1 px border.
  knob: { position: 'absolute', top: KNOB_INSET - BORDER, width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
});
