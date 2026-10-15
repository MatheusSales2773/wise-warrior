import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const GUILD_MEMBERS_PAGE_SIZE_DEFAULT = 20;
export const GUILD_MEMBERS_PAGE_SIZE_MAX = 50;

export class ListGuildMembersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(GUILD_MEMBERS_PAGE_SIZE_MAX)
  limit?: number;
}
