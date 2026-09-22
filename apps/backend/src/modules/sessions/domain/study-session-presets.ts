export const STUDY_SESSION_PRESETS = [900, 1500, 3000] as const;

export type StudySessionPreset = (typeof STUDY_SESSION_PRESETS)[number];

export function isStudySessionPreset(seconds: number): seconds is StudySessionPreset {
  return STUDY_SESSION_PRESETS.some((preset) => preset === seconds);
}
