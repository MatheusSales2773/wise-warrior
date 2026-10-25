import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useDashboardRefresh } from '@/features/dashboard/use-dashboard-refresh';

type Fetcher = jest.Mock<Promise<string>, []>;

function setup(fetchers: Record<string, Fetcher>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => {
    const queries = Object.entries(fetchers).map(([key, queryFn]) => useQuery({ queryKey: ['refresh-test', key], queryFn, retry: false }));
    return useDashboardRefresh(queries);
  }, { wrapper });
}

const succeeding = (): Fetcher => jest.fn().mockResolvedValue('ok');

describe('useDashboardRefresh', () => {
  it('refetches every registered query, including one added to the list', async () => {
    const fetchers = { profile: succeeding(), activity: succeeding(), metrics: succeeding(), extra: succeeding() };
    const { result } = await setup(fetchers);
    await waitFor(() => Object.values(fetchers).forEach((fetcher) => expect(fetcher).toHaveBeenCalledTimes(1)));

    await act(async () => { await result.current.refresh(); });

    Object.values(fetchers).forEach((fetcher) => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(result.current.partialErrorMessage).toBeNull();
    expect(result.current.statusMessage).toBe('Dados atualizados');
  });

  it.each(['profile', 'activity', 'metrics', 'extra'])('shows the partial failure message when %s fails', async (failing) => {
    const fetchers: Record<string, Fetcher> = { profile: succeeding(), activity: succeeding(), metrics: succeeding(), extra: succeeding() };
    const { result } = await setup(fetchers);
    await waitFor(() => Object.values(fetchers).forEach((fetcher) => expect(fetcher).toHaveBeenCalledTimes(1)));
    expect(result.current.partialErrorMessage).toBeNull();

    fetchers[failing]!.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await result.current.refresh(); });

    await waitFor(() => expect(result.current.partialErrorMessage).toBe('Alguns dados não foram atualizados.'));
    expect(result.current.statusMessage).toBeNull();
  });

  it('does not start a second round of requests while a refresh is pending', async () => {
    const fetchers = { profile: succeeding(), extra: succeeding() };
    const { result } = await setup(fetchers);
    await waitFor(() => Object.values(fetchers).forEach((fetcher) => expect(fetcher).toHaveBeenCalledTimes(1)));

    await act(async () => { await Promise.all([result.current.refresh(), result.current.refresh()]); });

    Object.values(fetchers).forEach((fetcher) => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
