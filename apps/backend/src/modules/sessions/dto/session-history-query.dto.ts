import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const SESSION_HISTORY_PAGE_SIZE_DEFAULT = 20;
export const SESSION_HISTORY_PAGE_SIZE_MAX = 50;

export class SessionHistoryQueryDto {
  /** The São Paulo calendar day, as the Dashboard metrics use it. Defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve estar no formato AAAA-MM-DD' })
  date?: string;

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
