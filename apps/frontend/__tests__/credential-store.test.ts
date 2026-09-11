import * as SecureStore from 'expo-secure-store';
import { credentialStore as nativeStore } from '@/core/auth/credential-store';
import { credentialStore as webStore } from '@/core/auth/credential-store.web';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'after-first-unlock',
  getItemAsync: jest.fn(async () => 'stored-token'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('credential store — web', () => {
  it('never persists a value and never touches Web Storage', async () => {
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(global, 'sessionStorage', { configurable: true, value: storage });

    await expect(webStore.read()).resolves.toBeNull();
    await expect(webStore.write('refresh-token')).resolves.toBeUndefined();
    await expect(webStore.remove()).resolves.toBeUndefined();

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});

describe('credential store — native', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a stable namespaced key with background-compatible accessibility and no biometric prompt', async () => {
    await nativeStore.write('session.secret');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'wise.auth.refresh',
      'session.secret',
      { keychainAccessible: 'after-first-unlock', requireAuthentication: false },
    );

    await expect(nativeStore.read()).resolves.toBe('stored-token');
    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('wise.auth.refresh', {
      keychainAccessible: 'after-first-unlock',
      requireAuthentication: false,
    });

    await nativeStore.remove();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('wise.auth.refresh');
  });

  it('propagates storage failures so callers can preserve or discard the session', async () => {
    mockedSecureStore.setItemAsync.mockRejectedValueOnce(new Error('keychain indisponível'));
    await expect(nativeStore.write('session.secret')).rejects.toThrow('keychain indisponível');
  });
});
