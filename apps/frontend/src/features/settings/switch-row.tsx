import { StyleSheet, Text, View } from 'react-native';
import { WiseSwitch, WiseText, theme } from '@/design-system';

type SwitchRowProps = { disabled?: boolean; hint: string; label: string; onChange(value: boolean): void; testID: string; value: boolean };

/** One row of the Figma "Card/Comportamento": title and hint on the left, the switch on the right. */
export function SwitchRow({ disabled, hint, label, onChange, testID, value }: SwitchRowProps) {
  return <View style={styles.switchRow}>
    <View style={styles.switchCopy}>
      <WiseText variant="label">{label}</WiseText>
      <Text allowFontScaling style={styles.switchHint}>{hint}</Text>
    </View>
    <WiseSwitch accessibilityHint={hint} accessibilityLabel={label} disabled={disabled} onValueChange={onChange} testID={testID} value={value} />
  </View>;
}

export const switchCardStyle = {
  marginTop: theme.space.stackTight, paddingHorizontal: theme.space.controlInset, paddingVertical: 6, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard,
} as const;

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: theme.space.stackTight },
  switchCopy: { flex: 1, gap: 2 },
  switchHint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
});
