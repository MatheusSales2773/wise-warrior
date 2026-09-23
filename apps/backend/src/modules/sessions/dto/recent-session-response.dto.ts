import type { StudySessionMode, StudySessionState } from '../entities/study-session.entity';

export class RecentSessionResponseDto {
  id: string;
  subject: string | null;
  mode: StudySessionMode;
  state: StudySessionState | null;
  startedAt: Date;
  endedAt: Date;
  durationValidSeconds: number;
  xpAwarded: number;
  discardedReason: string | null;
}
