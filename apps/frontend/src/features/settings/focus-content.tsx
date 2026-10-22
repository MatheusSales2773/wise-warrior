import { Pressable, StyleSheet, View } from 'react-native';
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

/** A labelled on/off row from the Foco card: title and hint on the left, the whole row is the switch. */
function SwitchRow({ checked, hint, label, onChange, testID }: { checked: boolean; hint: string; label: string; onChange(next: boolean): void; testID: string }) {
  const { focusProps, focusStyle } = useFocusRing();
  return <Pressable
    {...focusProps}
    accessibilityLabel={label}
    accessibilityRole="switch"
    accessibilityState={{ checked }}
    aria-checked={checked}
    onPress={() => onChange(!checked)}
    style={[styles.switchRow, focusStyle]}
    testID={testID}
  >
    <View style={styles.switchCopy}>
      <WiseText variant="label">{label}</WiseText>
      <WiseText color="textSecondary" variant="caption">{hint}</WiseText>
    </View>
    <View style={[styles.track, checked && styles.trackOn]}>
      <View style={[styles.knob, checked && styles.knobOn]} />
    </View>
  </Pressable>;
}

export function FocusContent() {
  const [selected, select] = useDevicePreference('defaultFocusDuration');
  const [confirmBeforeStopping, setConfirmBeforeStopping] = useDevicePreference('confirmBeforeStopping');
  return <View style={styles.stack} testID="settings-focus">
    <WiseText variant="label">Duração padrão</WiseText>
    <WiseText color="textSecondary" variant="body">A Forja abre com esta duração. Você ainda pode trocá-la antes de iniciar.</WiseText>
    <View accessibilityLabel="Duração padrão" accessibilityRole="radiogroup" style={styles.options}>
      {FOCUS_DURATIONS.map((duration) => <DurationOption checked={selected === duration} duration={duration} key={duration} onSelect={() => select(duration)} />)}
    </View>
    <SwitchRow
      checked={confirmBeforeStopping}
      hint="Evita perder o foco válido sem querer"
      label="Confirmar antes de encerrar"
      onChange={setConfirmBeforeStopping}
      testID="settings-focus-confirm-before-stopping"
    />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.space.inlineTight },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.stackTight },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: theme.layout.touchTarget, marginTop: theme.space.stackTight, paddingVertical: 12 },
  switchCopy: { flex: 1, gap: 2 },
  track: { width: 44, height: 26, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: theme.color.borderEmphasis, backgroundColor: theme.color.surfaceInset },
  trackOn: { borderColor: theme.color.accentPrimary, backgroundColor: theme.color.accentPrimary },
  knob: { width: 20, height: 20, marginLeft: 2, borderRadius: 10, backgroundColor: theme.color.textSecondary },
  knobOn: { marginLeft: 20, backgroundColor: theme.color.backgroundCanvas },
  option: { minWidth: theme.layout.touchTarget, minHeight: theme.layout.touchTarget, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.color.borderGhost, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceInset },
  optionChecked: { backgroundColor: 'rgba(212, 168, 90, 0.08)', borderColor: theme.color.borderEmphasis },
});
