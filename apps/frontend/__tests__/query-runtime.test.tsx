import { render, screen } from '@testing-library/react-native';
import { AppState, Platform, Text } from 'react-native';
import { focusManager, QueryClient, useQueryClient } from '@tanstack/react-query';
import { QueryRuntime, queryClient } from '@/core/query/query-runtime';

describe('query runtime', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: originalPlatform });
  });

  it('exports one QueryClient instance and renders children through the provider', async () => {
    let contextClient: QueryClient | undefined;
    function ClientProbe() {
      contextClient = useQueryClient();
      return <Text>child</Text>;
    }

    const view = await render(
      <QueryRuntime>
        <ClientProbe />
      </QueryRuntime>,
    );

    expect(screen.getByText('child')).toBeTruthy();
    expect(contextClient).toBe(queryClient);
    await view.unmount();
  });

  it('connects native AppState changes to focus and removes the subscription', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const remove = jest.fn();
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove } as never);
    const setFocused = jest.spyOn(focusManager, 'setFocused');

    const view = await render(
      <QueryRuntime>
        <Text>native</Text>
      </QueryRuntime>,
    );

    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    const handler = addEventListener.mock.calls[0]?.[1];
    handler?.('active');
    handler?.('background');
    expect(setFocused).toHaveBeenNthCalledWith(1, true);
    expect(setFocused).toHaveBeenNthCalledWith(2, false);

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the Web Query focus listeners under the library default', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const addEventListener = jest.spyOn(AppState, 'addEventListener');
    addEventListener.mockClear();

    const view = await render(
      <QueryRuntime>
        <Text>web</Text>
      </QueryRuntime>,
    );

    expect(addEventListener).not.toHaveBeenCalled();
    await view.unmount();
  });

});
