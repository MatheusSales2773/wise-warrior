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
