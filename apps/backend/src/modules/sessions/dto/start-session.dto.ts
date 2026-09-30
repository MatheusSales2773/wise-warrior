import { IsIn, ValidateIf } from 'class-validator';
import { STUDY_SESSION_PRESETS, type StudySessionPreset } from '../domain/study-session-presets';

export class StartSessionDto {
  @ValidateIf((_request, value) => value !== undefined)
  @IsIn(STUDY_SESSION_PRESETS)
  plannedDurationSeconds?: StudySessionPreset;
}
