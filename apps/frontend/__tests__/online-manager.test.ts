import { onlineManager } from '@tanstack/react-query';
import { installNativeOnlineManager, resetNativeOnlineManagerForTests } from '@/core/query/online-manager';

type Listener = (state: { isConnected?: boolean }) => void;

function fakeNetwork(initial: { isConnected?: boolean } | Promise<never>) {
  let listener: Listener | undefined;
  const remove = jest.fn();
  return {
    remove,
    emit: (state: { isConnected?: boolean }) => listener?.(state),
    network: {
      addNetworkStateListener: jest.fn((next: Listener) => { listener = next; return { remove }; }),
      getNetworkStateAsync: jest.fn(() => (initial instanceof Promise ? initial : Promise.resolve(initial))),
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('native online manager (expo-network)', () => {
  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    resetNativeOnlineManagerForTests();
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
    onlineManager.setOnline(true);
  });

  it('follows the device connection and removes the listener when nobody listens anymore', async () => {
    const fake = fakeNetwork({ isConnected: false });
    installNativeOnlineManager(fake.network as never);
    unsubscribe = onlineManager.subscribe(() => undefined);
    await flush();
    expect(onlineManager.isOnline()).toBe(false);

    fake.emit({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);
    fake.emit({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);

    unsubscribe();
    unsubscribe = undefined;
    expect(fake.remove).toHaveBeenCalled();
  });

  it('lets a listener event win over a late initial reading', async () => {
    let resolveInitial: (state: { isConnected: boolean }) => void = () => undefined;
    const fake = fakeNetwork({ isConnected: true });
    fake.network.getNetworkStateAsync.mockReturnValue(new Promise((resolve) => { resolveInitial = resolve; }) as never);
    installNativeOnlineManager(fake.network as never);
    unsubscribe = onlineManager.subscribe(() => undefined);

    fake.emit({ isConnected: false });
    resolveInitial({ isConnected: true });
    await flush();

    expect(onlineManager.isOnline()).toBe(false);
  });

  it('stays online when the connection is unknown or the reading fails', async () => {
    const unknown = fakeNetwork({});
    installNativeOnlineManager(unknown.network as never);
    unsubscribe = onlineManager.subscribe(() => undefined);
    await flush();
    expect(onlineManager.isOnline()).toBe(true);
    unknown.emit({});
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('installs once', () => {
    const first = fakeNetwork({ isConnected: true });
    const second = fakeNetwork({ isConnected: true });
    installNativeOnlineManager(first.network as never);
    installNativeOnlineManager(second.network as never);
    unsubscribe = onlineManager.subscribe(() => undefined);

    expect(first.network.addNetworkStateListener).toHaveBeenCalledTimes(1);
    expect(second.network.addNetworkStateListener).not.toHaveBeenCalled();
  });
});
