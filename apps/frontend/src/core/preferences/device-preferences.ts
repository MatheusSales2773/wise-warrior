import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { preferencesStorage } from './preferences-storage';
import type { PreferencesStorage } from './types';

export const FOCUS_DURATIONS = [900, 1500, 3000] as const;
export type FocusDuration = (typeof FOCUS_DURATIONS)[number];

export type DevicePreferences = {
  defaultFocusDuration: FocusDuration;
  suggestRecentSubjects: boolean;
  confirmBeforeStopping: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_PREFERENCES: Readonly<DevicePreferences> = {
  defaultFocusDuration: 1500,
  suggestRecentSubjects: true,
  confirmBeforeStopping: true,
  reduceMotion: false,
};

const isValid: { [K in keyof DevicePreferences]: (value: unknown) => value is DevicePreferences[K] } = {
  defaultFocusDuration: (value): value is FocusDuration => FOCUS_DURATIONS.includes(value as FocusDuration),
  suggestRecentSubjects: (value): value is boolean => typeof value === 'boolean',
  confirmBeforeStopping: (value): value is boolean => typeof value === 'boolean',
  reduceMotion: (value): value is boolean => typeof value === 'boolean',
};

/** Keeps the stored keys that hold a valid value; everything else falls back to the default. */
function parse(raw: string | null): Partial<DevicePreferences> {
  if (!raw) return {};
  try {
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null) return {};
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(isValid) as (keyof DevicePreferences)[]) {
      const value = (stored as Record<string, unknown>)[key];
      if (isValid[key](value)) result[key] = value;
    }
    return result as Partial<DevicePreferences>;
  } catch {
    return {};
  }
}

/**
 * Typed device preferences with defaults. `get` is synchronous (defaults until `load` settles) so screens render at
 * once; a failed read keeps the defaults, a failed write keeps the value for this run.
 */
export function createDevicePreferences(storage: PreferencesStorage) {
  let values: DevicePreferences = { ...DEFAULT_PREFERENCES };
  let loading: Promise<void> | null = null;
  let loaded = false;
  const touched: Partial<DevicePreferences> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const load = (): Promise<void> => {
    loading ??= (async () => storage.read())().then(parse, () => ({}) as Partial<DevicePreferences>).then((stored) => {
      // A choice made while the read was pending wins over the stored value.
      values = { ...DEFAULT_PREFERENCES, ...stored, ...touched };
      loaded = true;
      notify();
    });
    return loading;
  };
  return {
    get: (): DevicePreferences => values,
    isLoaded: () => loaded,
    load,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async set<K extends keyof DevicePreferences>(key: K, value: DevicePreferences[K]): Promise<void> {
      if (!isValid[key](value)) return;
      touched[key] = value;
      values = { ...values, [key]: value };
      notify();
      await load();
      try {
        await storage.write(JSON.stringify(values));
      } catch {
        // Storage unavailable: the choice holds until the app closes.
      }
    },
  };
}

export const devicePreferences = createDevicePreferences(preferencesStorage);

/** The current value of one preference, with a setter; starts the storage read on first use. */
export function useDevicePreference<K extends keyof DevicePreferences>(key: K): readonly [DevicePreferences[K], (value: DevicePreferences[K]) => void] {
  const snapshot = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.get, devicePreferences.get);
  useEffect(() => { void devicePreferences.load(); }, []);
  const set = useCallback((value: DevicePreferences[K]) => { void devicePreferences.set(key, value); }, [key]);
  return [snapshot[key], set] as const;
}
