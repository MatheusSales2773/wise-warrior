import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { WEB_DEVICE_LABELS } from '../device-labels';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  /** Rótulo previsível do dispositivo, exibido na lista de sessões ativas (ADR-009). */
  @IsOptional()
  @IsIn(WEB_DEVICE_LABELS)
  deviceLabel?: string;
}
