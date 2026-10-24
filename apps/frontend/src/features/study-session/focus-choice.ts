import { STUDY_SESSION_PRESETS, type PlannedDurationSeconds } from './api';

/** What the Forja starts: a Ciclo of a preset duration, or a Foco livre that counts up until the user stops. */
export const FREE_FOCUS = 'free';
export type FocusChoice = PlannedDurationSeconds | typeof FREE_FOCUS;

export type StudySessionKind = 'cycle' | 'free';

/** "Livre", or the preset in minutes: how the Forja names a focus in its controls. */
export function focusChoiceLabel(choice: FocusChoice): string {
  return choice === FREE_FOCUS ? 'Livre' : `${choice / 60} min`;
}

/** Seconds a Ciclo plans; a Foco livre plans none. */
export function plannedSeconds(choice: FocusChoice): number {
  return choice === FREE_FOCUS ? 0 : choice;
}

export const FOCUS_CHOICES: readonly FocusChoice[] = [...STUDY_SESSION_PRESETS, FREE_FOCUS];

/** XP a minute of valid focus is worth; the server grants it, the Forja only shows the estimate. */
export const XP_PER_FOCUS_MINUTE = 10;

/** XP a Ciclo of `choice` concludes with, or `null` for a Foco livre, whose XP depends on when the user stops. */
export function estimatedXp(choice: FocusChoice): number | null {
  return choice === FREE_FOCUS ? null : (choice / 60) * XP_PER_FOCUS_MINUTE;
}
