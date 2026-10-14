import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const RAID_PAGE_SIZE_DEFAULT = 20;
export const RAID_PAGE_SIZE_MAX = 50;

/** Paginação por cursor do Ranking interno e das Raids anteriores. */
export class RaidPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RAID_PAGE_SIZE_MAX)
  limit?: number;
}
