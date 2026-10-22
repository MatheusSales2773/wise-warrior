import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor, StyleSheet } from 'react-native';
import { WiseSwitch } from '@/design-system/components/WiseSwitch';
import { theme } from '@/design-system/tokens/theme';

// Animated interpolation hands back normalized rgba strings, so colors are compared as the platform parses them.
const color = (value: unknown) => processColor(value as string);
const track = () => StyleSheet.flatten(screen.getByTestId('notify-track').props.style);
const knob = () => StyleSheet.flatten(screen.getByTestId('notify-knob').props.style);

describe('WiseSwitch', () => {
  it('draws Switch/on: a gold 44×26 pill with the knob 3 px from the right edge', async () => {
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value />);

    expect(screen.getByRole('switch', { name: 'Notificar' }).props.accessibilityState.checked).toBe(true);
    expect(track()).toMatchObject({ width: 44, height: 26, borderRadius: 13, borderWidth: 1 });
    expect(color(track().backgroundColor)).toBe(color(theme.color.accentPrimary));
    expect(color(track().borderColor)).toBe(color(theme.color.accentPrimary));
    expect(knob()).toMatchObject({ width: 20, height: 20, borderRadius: 10, top: 2, left: 20 });
    expect(color(knob().backgroundColor)).toBe(color(theme.color.backgroundCanvas));
  });

  it('draws Switch/off: an inset pill with a gold hairline and the knob 3 px from the left edge', async () => {
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value={false} />);

    expect(screen.getByRole('switch', { name: 'Notificar' }).props.accessibilityState.checked).toBe(false);
    expect(color(track().backgroundColor)).toBe(color(theme.color.surfaceInset));
    expect(color(track().borderColor)).toBe(color(theme.color.borderEmphasis));
    expect(knob()).toMatchObject({ left: 2, top: 2 });
    expect(color(knob().backgroundColor)).toBe(color(theme.color.textTertiary));
  });

  it('asks for the opposite value on press', async () => {
    const onValueChange = jest.fn();
    await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={onValueChange} value />);

    await fireEvent.press(screen.getByRole('switch', { name: 'Notificar' }));

    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  describe('moving the knob', () => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    async function renderOff(reduceMotion: boolean) {
      jest.useFakeTimers();
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
      const view = await render(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value={false} />);
      await act(async () => undefined);
      await view.rerender(<WiseSwitch accessibilityLabel="Notificar" testID="notify" onValueChange={jest.fn()} value />);
    }

    it('slides to the new side over motion.quick', async () => {
      await renderOff(false);

      expect(knob().left).toBeLessThan(20);
      await act(async () => { jest.advanceTimersByTime(theme.motion.quick / 2); });
      const midway = knob().left as number;
      expect(midway).toBeGreaterThan(2);
      expect(midway).toBeLessThan(20);
      await act(async () => { jest.advanceTimersByTime(theme.motion.quick); });
      expect(knob().left).toBe(20);
    });

    it('jumps to the new side when reduce motion is on', async () => {
      await renderOff(true);

      expect(knob().left).toBe(20);
    });
  });
});
