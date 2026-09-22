import type { StudySessionMode } from '../entities/study-session.entity';

export class RecentSessionResponseDto {
  id: string;
  subject: string | null;
  mode: StudySessionMode;
  startedAt: Date;
  endedAt: Date;
  durationValidSeconds: number;
  xpAwarded: number;
  discardedReason: string | null;
}
