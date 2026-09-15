import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/**
 * The remote cache is deliberately runtime-only. Auth invalidation can clear
 * this client, and a new runtime starts with an empty cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

export type QueryRuntimeProviderProps = PropsWithChildren<{
  client?: QueryClient;
}>;

export function QueryRuntime({
  children,
  client = queryClient,
}: QueryRuntimeProviderProps) {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
