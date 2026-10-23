import type { CappedReason } from '../domain/session-validator';
import type { StudySessionKind, StudySessionMode, StudySessionState } from '../entities/study-session.entity';

export class RecentSessionResponseDto {
  id: string;
  subject: string | null;
  kind: StudySessionKind;
  mode: StudySessionMode;
  state: StudySessionState | null;
  startedAt: Date;
  endedAt: Date;
  durationValidSeconds: number;
  xpAwarded: number;
  discardedReason: string | null;
  cappedReason: CappedReason | null;
}
