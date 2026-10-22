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

const SUGGEST_RECENT_SUBJECTS_LABEL = 'Sugerir matérias recentes';
const SUGGEST_RECENT_SUBJECTS_HINT = 'Mostra suas últimas matérias na Forja';

/** Figma "Card/Comportamento": one card of switch rows, each with a title, a hint and the switch. */
function SuggestRecentSubjectsSwitch() {
  const [enabled, setEnabled] = useDevicePreference('suggestRecentSubjects');
  return <View style={styles.behaviorCard} testID="settings-focus-behavior">
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <WiseText variant="label">{SUGGEST_RECENT_SUBJECTS_LABEL}</WiseText>
        <Text allowFontScaling style={styles.switchHint}>{SUGGEST_RECENT_SUBJECTS_HINT}</Text>
      </View>
      <WiseSwitch
        accessibilityHint={SUGGEST_RECENT_SUBJECTS_HINT}
        accessibilityLabel={SUGGEST_RECENT_SUBJECTS_LABEL}
        onValueChange={setEnabled}
        testID="settings-focus-suggest-recent-subjects"
        value={enabled}
      />
    </View>
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
  behaviorCard: { marginTop: theme.space.stackTight, paddingHorizontal: theme.space.controlInset, paddingVertical: 6, borderRadius: theme.radius.card, borderWidth: theme.border.standard, borderColor: theme.color.borderSubtle, backgroundColor: theme.color.surfaceCard },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.stackTight, paddingVertical: theme.space.stackTight },
  switchCopy: { flex: 1, gap: 2 },
  switchHint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: theme.color.textSecondary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  option: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderGhost, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  optionChecked: { backgroundColor: 'rgba(212, 168, 90, 0.08)', borderColor: theme.color.borderEmphasis },
});
