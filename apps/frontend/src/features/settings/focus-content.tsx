import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { FOCUS_DURATIONS, useDevicePreference } from '@/core/preferences/device-preferences';
import { WiseText, theme } from '@/design-system';
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

const SUGGEST_RECENT_SUBJECTS_LABEL = 'Sugerir matérias recentes';
const SUGGEST_RECENT_SUBJECTS_HINT = 'Mostra suas últimas matérias na Forja';

function SuggestRecentSubjectsSwitch() {
  const [enabled, setEnabled] = useDevicePreference('suggestRecentSubjects');
  return <View style={styles.switchRow}>
    <View style={styles.switchCopy}>
      <WiseText variant="label">{SUGGEST_RECENT_SUBJECTS_LABEL}</WiseText>
      <WiseText color="textSecondary" variant="body">{SUGGEST_RECENT_SUBJECTS_HINT}</WiseText>
    </View>
    <Switch
      accessibilityHint={SUGGEST_RECENT_SUBJECTS_HINT}
      accessibilityLabel={SUGGEST_RECENT_SUBJECTS_LABEL}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onValueChange={setEnabled}
      testID="settings-focus-suggest-recent-subjects"
      value={enabled}
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
    <SuggestRecentSubjectsSwitch />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.inlineTight },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.stackTight, minHeight: theme.layout.touchTarget, marginTop: theme.space.stackTight },
  switchCopy: { flex: 1, gap: theme.space.inlineTight },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  option: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderGhost, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  optionChecked: { backgroundColor: 'rgba(212, 168, 90, 0.08)', borderColor: theme.color.borderEmphasis },
});
