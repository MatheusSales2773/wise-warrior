import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { STUDY_SESSION_PRESETS, type StudySessionPreset } from '../domain/study-session-presets';
import type { StudySessionMode } from '../entities/study-session.entity';

export class StartSessionDto {
  @ValidateIf((_request, value) => value !== undefined)
  @IsIn(STUDY_SESSION_PRESETS)
  plannedDurationSeconds?: StudySessionPreset;

  /** Matéria opcional; ausente, `null` ou só espaços são Sem matéria. Normalização e limite ficam no domínio. */
  @IsOptional()
  @IsString()
  subject?: string | null;

  /** Ausente é `solo`. O modo Guilda exige `raidId`, a Raid ativa da Guild do usuário. */
  @ValidateIf((_request, value) => value !== undefined)
  @IsIn(['solo', 'guild'])
  mode?: StudySessionMode;

  @ValidateIf((_request, value) => value !== undefined)
  @IsString()
  raidId?: string;
}
