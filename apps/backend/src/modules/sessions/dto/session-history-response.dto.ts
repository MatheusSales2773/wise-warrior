import { RecentSessionResponseDto } from './recent-session-response.dto';

export class SessionHistoryItemDto extends RecentSessionResponseDto {
  /** Place of a focus completed in full in the Pomodoro cycle (1 to 4); `null` for any other outcome. */
  cyclePosition: number | null;
}

export class SessionHistoryPageDto {
  /** The UTC day listed. */
  date: string;
  items: SessionHistoryItemDto[];
  nextCursor: string | null;
}
