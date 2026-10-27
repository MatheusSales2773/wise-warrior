import * as SecureStore from 'expo-secure-store';
import type { PreferencesStorage } from './types';

const KEY = 'wise.device.preferences';

/** Native: one SecureStore entry on this device, kept across logouts and never migrated to another device. */
export const preferencesStorage: PreferencesStorage = {
  read: () => SecureStore.getItemAsync(KEY),
  write: (value) => SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
};
