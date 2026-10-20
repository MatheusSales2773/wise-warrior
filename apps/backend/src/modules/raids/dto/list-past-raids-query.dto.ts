import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const PAST_RAIDS_PAGE_SIZE_DEFAULT = 10;
export const PAST_RAIDS_PAGE_SIZE_MAX = 20;

export class ListPastRaidsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAST_RAIDS_PAGE_SIZE_MAX)
  limit?: number;
}
