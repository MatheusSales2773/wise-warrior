import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type AccessibilityRole } from 'react-native';
import { theme } from '../tokens/theme';
import { controlStyles } from './control-styles';

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

/** Figma "Switch/on" and "Switch/off": a 44×26 pill with a 20 px knob, 3 px from the edge on the side it rests. */
export function WiseSwitch({ accessibilityHint, accessibilityLabel, onValueChange, testID, value }: WiseSwitchProps) {
  const [focused, setFocused] = useState(false);
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
      style={[styles.track, value ? styles.trackOn : styles.trackOff, focused && Platform.OS === 'web' && controlStyles.webFocus]}
      testID={testID}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2, borderWidth: BORDER },
  trackOn: { backgroundColor: theme.color.accentPrimary, borderColor: theme.color.accentPrimary },
  trackOff: { backgroundColor: theme.color.surfaceInset, borderColor: theme.color.borderEmphasis },
  // Positions are relative to the padding box, inside the 1 px border.
  knob: { position: 'absolute', top: KNOB_INSET - BORDER, width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  knobOn: { left: WIDTH - KNOB_INSET - KNOB - BORDER, backgroundColor: theme.color.backgroundCanvas },
  knobOff: { left: KNOB_INSET - BORDER, backgroundColor: theme.color.textTertiary },
});
