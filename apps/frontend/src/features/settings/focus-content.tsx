import { Pressable, StyleSheet, View } from 'react-native';
import { FOCUS_DURATIONS, useDevicePreference } from '@/core/preferences/device-preferences';
import { WiseText, theme } from '@/design-system';
import { useFocusRing } from '@/features/character/character-parts';
import { SwitchCard, SwitchRow } from './switch-row';

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

function BehaviorCard() {
  const [suggestRecentSubjects, setSuggestRecentSubjects] = useDevicePreference('suggestRecentSubjects');
  const [confirmBeforeStopping, setConfirmBeforeStopping] = useDevicePreference('confirmBeforeStopping');
  return <SwitchCard testID="settings-focus-behavior">
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
  </SwitchCard>;
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
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  option: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderGhost, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  optionChecked: { backgroundColor: 'rgba(212, 168, 90, 0.08)', borderColor: theme.color.borderEmphasis },
});
