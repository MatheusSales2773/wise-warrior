import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const RAID_RANKING_PAGE_SIZE_DEFAULT = 20;
export const RAID_RANKING_PAGE_SIZE_MAX = 50;

export class ListRaidRankingQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RAID_RANKING_PAGE_SIZE_MAX)
  limit?: number;
}
