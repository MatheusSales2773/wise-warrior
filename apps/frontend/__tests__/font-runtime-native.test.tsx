import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FontGate, useFontFallback } from '@/design-system/components/font-runtime';

const mockHideAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-splash-screen', () => ({
  hideAsync: () => mockHideAsync(),
}));

function NativeProbe() {
  return <Text>{useFontFallback() ? 'fallback' : 'embedded'}</Text>;
}

describe('native font runtime', () => {
  beforeEach(() => mockHideAsync.mockClear());

  it('renders embedded fonts without runtime loading and hides the splash once', async () => {
    const view = await render(
      <FontGate>
        <NativeProbe />
      </FontGate>,
    );

    expect(screen.getByText('embedded')).toBeTruthy();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    await view.rerender(
      <FontGate>
        <NativeProbe />
      </FontGate>,
    );
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });
});
