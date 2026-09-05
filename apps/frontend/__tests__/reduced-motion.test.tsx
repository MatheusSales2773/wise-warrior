import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { MotionRuntime, useReducedMotion, useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { Text } from 'react-native';

function MotionProbe() {
  return <Text>{useRuntimeMotionDuration()}</Text>;
}

describe('useReducedMotion', () => {
  const remove = jest.fn();
  let onChange: ((enabled: boolean) => void) | undefined;

  beforeEach(() => {
    remove.mockClear();
    onChange = undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
      expect(event).toBe('reduceMotionChanged');
      onChange = handler;
      return { remove };
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads the initial system preference and responds to changes', async () => {
    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(true));

    await act(async () => onChange?.(false));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('removes the native listener on unmount', async () => {
    const { unmount } = await renderHook(() => useReducedMotion());

    await unmount();

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });

  it('keeps motion enabled when the initial query fails', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('unavailable'));
    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('disables motion until the initial system preference is known', async () => {
    let resolvePreference: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
      () => new Promise<boolean>((resolve) => { resolvePreference = resolve; }),
    );

    await render(
      <MotionRuntime>
        <MotionProbe />
      </MotionRuntime>,
    );

    expect(screen.getByText('0')).toBeTruthy();
    await act(async () => resolvePreference?.(false));
    await waitFor(() => expect(screen.getByText('180')).toBeTruthy());
  });

  it('integrates the system preference into the runtime duration', async () => {
    await render(
      <MotionRuntime>
        <MotionProbe />
      </MotionRuntime>,
    );

    await waitFor(() => expect(screen.getByText('0')).toBeTruthy());
    await act(async () => onChange?.(false));
    await waitFor(() => expect(screen.getByText('180')).toBeTruthy());
  });
});
