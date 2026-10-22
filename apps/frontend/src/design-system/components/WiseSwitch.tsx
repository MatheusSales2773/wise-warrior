import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../tokens/theme';
import { WiseText } from './WiseText';
import { controlStyles } from './control-styles';

export type WiseSwitchProps = {
  checked: boolean;
  /** One line under the label saying what the switch does. */
  hint: string;
  label: string;
  onChange: (next: boolean) => void;
  testID?: string;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const KNOB = 20;
const KNOB_INSET = (TRACK_HEIGHT - KNOB) / 2 - 1; // The track's 1px border sits outside the inset.

/** A labelled on/off row (Figma "Switch"): title and hint on the left, and the whole row toggles. */
export function WiseSwitch({ checked, hint, label, onChange, testID }: WiseSwitchProps) {
  const [focused, setFocused] = useState(false);
  return <Pressable
    accessibilityLabel={label}
    accessibilityRole="switch"
    accessibilityState={{ checked }}
    aria-checked={checked}
    onBlur={() => setFocused(false)}
    onFocus={() => setFocused(true)}
    onPress={() => onChange(!checked)}
    style={[styles.row, focused && Platform.OS === 'web' && controlStyles.webFocus]}
    testID={testID}
  >
    <View style={styles.copy}>
      <WiseText variant="label">{label}</WiseText>
      <Text style={styles.hint}>{hint}</Text>
    </View>
    <View style={[styles.track, checked && styles.trackOn]}>
      <View style={[styles.knob, checked && styles.knobOn]} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: theme.layout.touchTarget, paddingVertical: 12 },
  copy: { flex: 1, gap: 2 },
  // The caption role tracks 2px, which is for uppercase tags; the hint is a sentence.
  hint: { fontFamily: theme.type.body.fontFamily, fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, justifyContent: 'center', borderRadius: TRACK_HEIGHT / 2, borderWidth: 1, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset },
  trackOn: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.accentPrimary },
  knob: { width: KNOB, height: KNOB, marginLeft: KNOB_INSET, borderRadius: KNOB / 2, backgroundColor: theme.color.textSecondary },
  knobOn: { marginLeft: TRACK_WIDTH - KNOB - KNOB_INSET - 2, backgroundColor: theme.color.backgroundCanvas },
});
