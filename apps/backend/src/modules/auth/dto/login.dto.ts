import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  /** Rótulo opcional do dispositivo, exibido na lista de sessões ativas (ADR-009). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}
