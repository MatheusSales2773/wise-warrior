import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const GUILDS_PAGE_SIZE_DEFAULT = 20;
export const GUILDS_PAGE_SIZE_MAX = 20;

export class ListGuildsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(GUILDS_PAGE_SIZE_MAX)
  limit?: number;
}
