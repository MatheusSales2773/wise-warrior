import { EARLY_STOP_MIN_SECONDS } from './stop-confirmation';

/** The server's default rate (ADR-011: 10 XP per full minute of valid focus). The Forja shows it as an estimate; the confirmed XP comes with the result. */
const XP_PER_MINUTE = 10;

/** XP of `validSeconds` of valid focus: nothing below five minutes, whatever the planned duration. */
export function xpForFocus(validSeconds: number): number {
  if (validSeconds < EARLY_STOP_MIN_SECONDS) return 0;
  return Math.floor(validSeconds / 60) * XP_PER_MINUTE;
}

/** "1h 20min" for the focus of the day; under an hour, just the minutes. */
export function formatFocusToday(validSeconds: number): string {
  const minutes = Math.floor(validSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${rest}min`;
}
