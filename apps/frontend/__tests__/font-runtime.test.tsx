import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FontGate, useFontFallback } from '@/design-system/components/font-runtime.web';

const mockUseFonts = jest.fn();
const mockHideAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: () => mockHideAsync(),
}));

function RuntimeProbe() {
  const usesFallback = useFontFallback();
  return <Text>{usesFallback ? 'fallback' : 'custom'}</Text>;
}

describe('font runtime', () => {
  beforeEach(() => {
    mockUseFonts.mockReset();
    mockHideAsync.mockClear();
  });

  it('keeps content behind the splash while fonts are pending', async () => {
    mockUseFonts.mockReturnValue([false, null]);

    await render(
      <FontGate>
        <RuntimeProbe />
      </FontGate>,
    );

    expect(screen.queryByText('custom')).toBeNull();
    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it('shows custom typography and hides the splash once after success', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const view = await render(
      <FontGate>
        <RuntimeProbe />
      </FontGate>,
    );

    expect(screen.getByText('custom')).toBeTruthy();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    await view.rerender(
      <FontGate>
        <RuntimeProbe />
      </FontGate>,
    );
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('shows fallback typography and hides the splash once after failure', async () => {
    mockUseFonts.mockReturnValue([false, new Error('font failure')]);

    await render(
      <FontGate>
        <RuntimeProbe />
      </FontGate>,
    );

    expect(screen.getByText('fallback')).toBeTruthy();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the ready UI visible when hiding the splash rejects', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockHideAsync.mockRejectedValueOnce(new Error('native splash already hidden'));

    await render(
      <FontGate>
        <RuntimeProbe />
      </FontGate>,
    );

    expect(screen.getByText('custom')).toBeTruthy();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });
});
