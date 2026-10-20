import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';

type NetworkApi = Pick<typeof Network, 'addNetworkStateListener' | 'getNetworkStateAsync'>;

let installed = false;

/**
 * Feeds TanStack Query's `onlineManager` from expo-network on iOS and Android, as the TanStack Query v5 React
 * Native guide does; the browser already reports it on Web. Offline, queries and mutations pause instead of
 * failing, and they resume (with a refetch of the active Study Session) when the network comes back.
 */
export function installNativeOnlineManager(network: NetworkApi = Network): void {
  if (installed) return;
  installed = true;
  onlineManager.setEventListener((setOnline) => {
    let initialised = false;
    // An unknown `isConnected` keeps the app online: only a reported disconnection pauses the requests.
    const subscription = network.addNetworkStateListener((state) => {
      initialised = true;
      setOnline(state.isConnected !== false);
    });
    network.getNetworkStateAsync()
      .then((state) => {
        if (!initialised) setOnline(state.isConnected !== false);
      })
      .catch(() => {
        // getNetworkStateAsync can reject on some platforms; the listener still reports changes.
      });
    return () => subscription?.remove?.();
  });
}

/** Test hook: lets each test install its own fake network. */
export function resetNativeOnlineManagerForTests(): void {
  installed = false;
}

const subscribe = (onChange: () => void) => onlineManager.subscribe(() => onChange());
const isOnline = () => onlineManager.isOnline();

/** Whether the device has a network connection, as TanStack Query sees it. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, isOnline);
}
