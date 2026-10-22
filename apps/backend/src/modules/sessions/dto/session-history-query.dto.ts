import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const SESSION_HISTORY_PAGE_SIZE_DEFAULT = 20;
export const SESSION_HISTORY_PAGE_SIZE_MAX = 50;

export const SESSION_HISTORY_STATES = ['completed', 'truncated', 'discarded'] as const;
export type SessionHistoryState = (typeof SESSION_HISTORY_STATES)[number];

export class SessionHistoryQueryDto {
  /** Limits the list to one São Paulo calendar day. Without it the list runs through every day. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve estar no formato AAAA-MM-DD' })
  date?: string;

  /** Outcome filter; absent lists every outcome that counted. */
  @IsOptional()
  @IsIn(SESSION_HISTORY_STATES)
  state?: SessionHistoryState;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SESSION_HISTORY_PAGE_SIZE_MAX)
  limit?: number;
}
