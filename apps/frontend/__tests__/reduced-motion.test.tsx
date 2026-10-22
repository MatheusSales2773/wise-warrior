import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { MotionRuntime, useReducedMotion, useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { Text } from 'react-native';
import { AccessibilityContent } from '@/features/settings/accessibility-content';
import { devicePreferences } from '@/core/preferences/device-preferences';

jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));

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

describe('the Reduzir movimento preference', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await devicePreferences.set('reduceMotion', false);
  });

  it('reduces motion immediately when on, even if the system does not ask for it', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    await render(<MotionRuntime><MotionProbe /></MotionRuntime>);
    await waitFor(() => expect(screen.getByText('180')).toBeTruthy());

    await act(async () => { await devicePreferences.set('reduceMotion', true); });
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('keeps motion reduced when the system asks for it and the preference is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    await render(<MotionRuntime><MotionProbe /></MotionRuntime>);
    await waitFor(() => expect(devicePreferences.get().reduceMotion).toBe(false));
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('reduces the app motion as soon as the settings switch is pressed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    await render(<MotionRuntime><MotionProbe /><AccessibilityContent /></MotionRuntime>);
    await waitFor(() => expect(screen.getByText('180')).toBeTruthy());

    await fireEvent.press(screen.getByRole('switch', { name: 'Reduzir movimento' }));

    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the stored value, enabled, until the system answers', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise<boolean>(() => undefined));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    await render(<AccessibilityContent />);

    expect(screen.getByRole('switch', { name: 'Reduzir movimento' }).props.accessibilityState).toEqual({ checked: false, disabled: false });
  });
});
