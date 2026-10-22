import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { WiseSwitch } from '@/design-system/components/WiseSwitch';
import { theme } from '@/design-system/tokens/theme';

const track = () => StyleSheet.flatten(screen.getByRole('switch', { name: 'Notificar' }).props.style);
const knob = () => StyleSheet.flatten(screen.getByTestId('notify-knob').props.style);

describe('WiseSwitch', () => {
  it('draws Switch/on: a gold 44×26 pill with the knob 3 px from the right edge', async () => {
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value />);

    expect(screen.getByRole('switch', { name: 'Notificar' }).props.accessibilityState.checked).toBe(true);
    expect(track()).toMatchObject({ width: 44, height: 26, borderRadius: 13, borderWidth: 1, backgroundColor: theme.color.accentPrimary, borderColor: theme.color.accentPrimary });
    expect(knob()).toMatchObject({ width: 20, height: 20, borderRadius: 10, top: 2, left: 20, backgroundColor: theme.color.backgroundCanvas });
  });

  it('draws Switch/off: an inset pill with a gold hairline and the knob 3 px from the left edge', async () => {
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value={false} />);

    expect(screen.getByRole('switch', { name: 'Notificar' }).props.accessibilityState.checked).toBe(false);
    expect(track()).toMatchObject({ backgroundColor: theme.color.surfaceInset, borderColor: theme.color.borderEmphasis });
    expect(knob()).toMatchObject({ left: 2, top: 2, backgroundColor: theme.color.textTertiary });
  });

  it('asks for the opposite value on press', async () => {
    const onValueChange = jest.fn();
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={onValueChange} value />);

    await fireEvent.press(screen.getByRole('switch', { name: 'Notificar' }));

    expect(onValueChange).toHaveBeenCalledWith(false);
  });
});
