import { STUDY_SESSION_PRESETS, type PlannedDurationSeconds } from './api';

/** What the Forja starts: a Ciclo of a preset duration, or a Foco livre that counts up until the user stops. */
export const FREE_FOCUS = 'free';
export type FocusChoice = PlannedDurationSeconds | typeof FREE_FOCUS;

export const FOCUS_CHOICES: readonly FocusChoice[] = [...STUDY_SESSION_PRESETS, FREE_FOCUS];
