import * as SecureStore from 'expo-secure-store';
import type { CredentialStore } from './types';

const REFRESH_KEY = 'wise.auth.refresh';

const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

/**
 * Implementação nativa (iOS/Android). A credencial rotativa fica no
 * SecureStore, acessível somente com o aparelho desbloqueado e sem
 * `requireAuthentication` (renovação em background não pode abrir prompt).
 */
export const credentialStore: CredentialStore = {
  read: () => SecureStore.getItemAsync(REFRESH_KEY, options),
  write: (value) => SecureStore.setItemAsync(REFRESH_KEY, value, options),
  remove: () => SecureStore.deleteItemAsync(REFRESH_KEY),
};
