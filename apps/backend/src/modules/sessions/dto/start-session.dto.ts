import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartSessionDto {
  @IsString()
  @MaxLength(80)
  subject: string;

  @IsIn(['solo', 'guild'])
  mode: 'solo' | 'guild';

  /** Obrigatório quando mode = 'guild' — validado no service, não no DTO. */
  @IsOptional()
  @IsUUID()
  raidId?: string;
}
