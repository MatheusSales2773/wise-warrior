import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FOCUS_DURATIONS, useDevicePreference } from '@/core/preferences/device-preferences';
import { WiseSwitch, WiseText, theme } from '@/design-system';
import { useFocusRing } from '@/features/character/character-parts';

/** "25 min": the default Forja duration, as shown beside Foco and in its phone row. */
export function useDefaultFocusLabel(): string {
  const [duration] = useDevicePreference('defaultFocusDuration');
  return `${duration / 60} min`;
}

function DurationOption({ checked, duration, onSelect }: { checked: boolean; duration: number; onSelect(): void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Pressable
    {...focusProps}
    accessibilityLabel={`${duration / 60} minutos`}
    accessibilityRole="radio"
    accessibilityState={{ checked }}
    aria-checked={checked}
    onPress={onSelect}
    style={[styles.option, checked && styles.optionChecked, focusStyle]}
    testID={`settings-focus-duration-${duration / 60}`}
  >
    <WiseText variant="label">{duration / 60} min</WiseText>
  </Pressable>;
}

type SwitchRowProps = { hint: string; label: string; onChange(value: boolean): void; testID: string; value: boolean };

/** One row of the Figma "Card/Comportamento": title and hint on the left, the switch on the right. */
function SwitchRow({ hint, label, onChange, testID, value }: SwitchRowProps) {
  return <View style={styles.switchRow}>
    <View style={styles.switchCopy}>
      <WiseText variant="label">{label}</WiseText>
      <Text allowFontScaling style={styles.switchHint}>{hint}</Text>
    </View>
    <WiseSwitch accessibilityHint={hint} accessibilityLabel={label} onValueChange={onChange} testID={testID} value={value} />
  </View>;
}

function BehaviorCard() {
  const [suggestRecentSubjects, setSuggestRecentSubjects] = useDevicePreference('suggestRecentSubjects');
  const [confirmBeforeStopping, setConfirmBeforeStopping] = useDevicePreference('confirmBeforeStopping');
  return <View style={styles.behaviorCard} testID="settings-focus-behavior">
    <SwitchRow
      hint="Mostra suas últimas matérias na Forja"
      label="Sugerir matérias recentes"
      onChange={setSuggestRecentSubjects}
      testID="settings-focus-suggest-recent-subjects"
      value={suggestRecentSubjects}
    />
    <SwitchRow
      hint="Evita perder o foco válido sem querer"
      label="Confirmar antes de encerrar"
      onChange={setConfirmBeforeStopping}
      testID="settings-focus-confirm-before-stopping"
      value={confirmBeforeStopping}
    />
  </View>;
}

export function FocusContent() {
  const [selected, select] = useDevicePreference('defaultFocusDuration');
  return <View style={styles.stack} testID="settings-focus">
    <WiseText variant="label">Duração padrão</WiseText>
    <WiseText color="textSecondary" variant="body">A Forja abre com esta duração. Você ainda pode trocá-la antes de iniciar.</WiseText>
    <View accessibilityLabel="Duração padrão" accessibilityRole="radiogroup" style={styles.options}>
      {FOCUS_DURATIONS.map((duration) => <DurationOption checked={selected === duration} duration={duration} key={duration} onSelect={() => select(duration)} />)}
    </View>
    <BehaviorCard />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.inlineTight },
  behaviorCard: { marginTop: theme.space.stackTight, paddingHorizontal: theme.space.controlInset, paddingVertical: 6, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: theme.space.stackTight },
  switchCopy: { flex: 1, gap: 2 },
  switchHint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  option: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderGhost, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  optionChecked: { backgroundColor: 'rgba(212, 168, 90, 0.08)', borderColor: theme.color.borderEmphasis },
});
