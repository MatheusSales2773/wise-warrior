/** Raw, per-device storage for the serialized preferences. Reads and writes may reject. */
export type PreferencesStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
};
