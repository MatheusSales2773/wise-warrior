import { View } from 'react-native';
import { useDevicePreference } from '@/core/preferences/device-preferences';
import { useSystemReducedMotion } from '@/design-system/components/motion-runtime';
import { switchCardStyle, SwitchRow } from './switch-row';

/** "Reduzir movimento": the switch only adds reduction, so a system that already asks for it pins the switch on. */
export function AccessibilityContent() {
  const [reduceMotion, setReduceMotion] = useDevicePreference('reduceMotion');
  const systemReduces = useSystemReducedMotion();
  return <View style={switchCardStyle} testID="settings-accessibility">
    <SwitchRow
      disabled={systemReduces}
      hint={systemReduces ? 'O app segue a configuração de movimento do seu sistema.' : 'Reduz as animações do app inteiro'}
      label="Reduzir movimento"
      onChange={setReduceMotion}
      testID="settings-accessibility-reduce-motion"
      value={systemReduces || reduceMotion}
    />
  </View>;
}
