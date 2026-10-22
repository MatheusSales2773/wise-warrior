import { DEFAULT_PREFERENCES, createDevicePreferences } from '@/core/preferences/device-preferences';
import type { PreferencesStorage } from '@/core/preferences/types';

function memoryStorage(initial: string | null = null) {
  const storage: { value: string | null } = { value: initial };
  return {
    value: () => storage.value,
    read: jest.fn<ReturnType<PreferencesStorage['read']>, []>(async () => storage.value),
    write: jest.fn<ReturnType<PreferencesStorage['write']>, [string]>(async (value) => { storage.value = value; }),
  };
}

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 42,
  getItemAsync: jest.fn(async () => 'stored'),
  setItemAsync: jest.fn(async () => undefined),
}));

describe('device preferences', () => {
  it('starts on the defaults and keeps them when nothing is stored', async () => {
    const preferences = createDevicePreferences(memoryStorage());
    expect(preferences.get()).toEqual(DEFAULT_PREFERENCES);
    await preferences.load();
    expect(preferences.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to the defaults when the read fails', async () => {
    const storage = memoryStorage();
    storage.read.mockRejectedValue(new Error('keychain locked'));
    const preferences = createDevicePreferences(storage);
    await preferences.load();
    expect(preferences.get()).toEqual(DEFAULT_PREFERENCES);
    expect(preferences.isLoaded()).toBe(true);
  });

  it('ignores corrupt data and invalid values key by key', async () => {
    const corrupt = createDevicePreferences(memoryStorage('{nope'));
    await corrupt.load();
    expect(corrupt.get()).toEqual(DEFAULT_PREFERENCES);

    const partial = createDevicePreferences(memoryStorage(JSON.stringify({ defaultFocusDuration: 1200, reduceMotion: true, confirmBeforeStopping: 'yes' })));
    await partial.load();
    expect(partial.get()).toEqual({ ...DEFAULT_PREFERENCES, reduceMotion: true });
  });

  it('persists a choice and restores it in a new instance', async () => {
    const storage = memoryStorage();
    const first = createDevicePreferences(storage);
    await first.set('defaultFocusDuration', 3000);
    expect(first.get().defaultFocusDuration).toBe(3000);

    const second = createDevicePreferences(storage);
    await second.load();
    expect(second.get().defaultFocusDuration).toBe(3000);
  });

  it('keeps a choice made while the read is still pending', async () => {
    const storage = memoryStorage(JSON.stringify({ defaultFocusDuration: 900 }));
    const preferences = createDevicePreferences(storage);
    const loading = preferences.load();
    await preferences.set('defaultFocusDuration', 3000);
    await loading;
    expect(preferences.get().defaultFocusDuration).toBe(3000);
  });

  it('keeps the stored keys it did not read when it writes a choice', async () => {
    const storage = memoryStorage(JSON.stringify({ reduceMotion: true, confirmBeforeStopping: false }));
    storage.read.mockRejectedValueOnce(new Error('keychain locked'));
    const preferences = createDevicePreferences(storage);
    await preferences.load();
    expect(preferences.get().reduceMotion).toBe(false);

    await preferences.set('defaultFocusDuration', 900);

    expect(JSON.parse(storage.value() as string)).toEqual({ reduceMotion: true, confirmBeforeStopping: false, defaultFocusDuration: 900 });
  });

  it('does not write over the stored data when it cannot read it back', async () => {
    const storage = memoryStorage(JSON.stringify({ reduceMotion: true }));
    const preferences = createDevicePreferences(storage);
    await preferences.load();
    storage.read.mockRejectedValue(new Error('keychain locked'));
    await preferences.set('defaultFocusDuration', 900);
    expect(storage.write).not.toHaveBeenCalled();
    expect(preferences.get().defaultFocusDuration).toBe(900);
  });

  it('reads again after a failed read and keeps the choices made meanwhile', async () => {
    const storage = memoryStorage(JSON.stringify({ reduceMotion: true }));
    storage.read.mockRejectedValueOnce(new Error('keychain locked'));
    const preferences = createDevicePreferences(storage);
    await preferences.load();
    await preferences.set('defaultFocusDuration', 900).catch(() => undefined);
    await preferences.load();
    expect(preferences.get()).toEqual({ ...DEFAULT_PREFERENCES, reduceMotion: true, defaultFocusDuration: 900 });
  });

  it('keeps the choice for this run when the write fails, and notifies subscribers', async () => {
    const storage = memoryStorage();
    storage.write.mockRejectedValue(new Error('quota'));
    const preferences = createDevicePreferences(storage);
    const listener = jest.fn();
    preferences.subscribe(listener);
    await expect(preferences.set('reduceMotion', true)).resolves.toBeUndefined();
    expect(preferences.get().reduceMotion).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('falls back to the defaults when the storage throws synchronously', async () => {
    const preferences = createDevicePreferences({ read: () => { throw new Error('native module missing'); }, write: async () => undefined });
    await preferences.load();
    expect(preferences.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects a duration outside 15, 25 and 50 minutes', async () => {
    const preferences = createDevicePreferences(memoryStorage());
    await preferences.set('defaultFocusDuration', 1200 as never);
    expect(preferences.get().defaultFocusDuration).toBe(1500);
  });
});

describe('preferences storage', () => {
  it('keeps the web preferences in localStorage and the native ones in SecureStore', async () => {
    const items = new Map<string, string>();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value) },
    });
    const { preferencesStorage: web } = require('@/core/preferences/preferences-storage.web');
    await web.write('{"reduceMotion":true}');
    expect(items.get('wise.device.preferences')).toBe('{"reduceMotion":true}');
    await expect(web.read()).resolves.toBe('{"reduceMotion":true}');

    const SecureStore = require('expo-secure-store');
    const { preferencesStorage: native } = require('@/core/preferences/preferences-storage.native');
    await native.write('x');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wise.device.preferences', 'x', { keychainAccessible: 42 });
    await expect(native.read()).resolves.toBe('stored');
  });
});
