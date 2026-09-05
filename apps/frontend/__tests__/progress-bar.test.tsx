import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { ProgressBar } from '@/design-system/components/ProgressBar';

describe('ProgressBar', () => {
  it.each([[25, '25%'], [-10, '0%'], [140, '100%']] as const)('clamps value %s only visually to %s', async (value, width) => {
    await render(<ProgressBar value={value} accessibilityLabel="Progresso" testID="progress" />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100, now: value });
    expect(StyleSheet.flatten(screen.getByTestId('progress-fill', { includeHiddenElements: true }).props.style).width).toBe(width);
  });

  it('normalizes a nonzero minimum and preserves the original accessible range', async () => {
    await render(<ProgressBar minimumValue={20} maximumValue={60} value={30} testID="progress" />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 20, max: 60, now: 30 });
    expect(StyleSheet.flatten(screen.getByTestId('progress-fill', { includeHiddenElements: true }).props.style).width).toBe('25%');
  });

  it.each([[10, 10], [20, 10]])('rejects an invalid development interval %s..%s', async (minimumValue, maximumValue) => {
    await expect(render(<ProgressBar minimumValue={minimumValue} maximumValue={maximumValue} value={10} />)).rejects.toThrow(/minimumValue.*maximumValue/);
  });

  it('omits the current value when explicitly indeterminate and disables native animation for reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    let change: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, callback: (enabled: boolean) => void) => {
      change = callback;
      return { remove: jest.fn() };
    }) as never);
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const view = await render(<ProgressBar indeterminate testID="progress" />);
      expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100 });
      expect(screen.getByRole('progressbar').props['aria-valuenow']).toBeUndefined();
      expect(screen.getByRole('progressbar').props['aria-busy']).toBe(true);
      expect(timing).not.toHaveBeenCalled();
      expect(StyleSheet.flatten(screen.getByTestId('progress-fill', { includeHiddenElements: true }).props.style).opacity).toBe(1);
      await act(() => change?.(false));
      await waitFor(() => expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 240 })));
      await act(() => change?.(true));
      expect(StyleSheet.flatten(screen.getByTestId('progress-fill', { includeHiddenElements: true }).props.style).opacity).toBe(1);
      await view.rerender(<ProgressBar value={70} testID="progress" />);
      expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(70);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
