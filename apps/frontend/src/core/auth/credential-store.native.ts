import * as SecureStore from 'expo-secure-store';
import type { CredentialStore } from './types';

const REFRESH_KEY = 'wise.auth.refresh';
const LOGOUT_MARKER_KEY = 'wise.auth.logout.marker';
const LOGOUT_MARKER_VALUE = '1';

const options = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
} as const;

/**
 * Implementação nativa (iOS/Android). A credencial rotativa fica no
 * SecureStore, acessível em background depois do primeiro desbloqueio, sem
 * migração para outro dispositivo e sem prompt biométrico obrigatório.
 */
export const credentialStore: CredentialStore = {
  read: () => SecureStore.getItemAsync(REFRESH_KEY, options),
  write: (value) => SecureStore.setItemAsync(REFRESH_KEY, value, options),
  remove: () => SecureStore.deleteItemAsync(REFRESH_KEY),
  readLogoutMarker: async () => (
    await SecureStore.getItemAsync(LOGOUT_MARKER_KEY, options)
  ) === LOGOUT_MARKER_VALUE,
  writeLogoutMarker: () => SecureStore.setItemAsync(LOGOUT_MARKER_KEY, LOGOUT_MARKER_VALUE, options),
  removeLogoutMarker: () => SecureStore.deleteItemAsync(LOGOUT_MARKER_KEY),
};
