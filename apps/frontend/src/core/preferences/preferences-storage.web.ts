import type { PreferencesStorage } from './types';

const KEY = 'wise.device.preferences';

/** Web: one `localStorage` entry in this browser, kept across logouts. */
export const preferencesStorage: PreferencesStorage = {
  read: async () => localStorage.getItem(KEY),
  write: async (value) => localStorage.setItem(KEY, value),
};
