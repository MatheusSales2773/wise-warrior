import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WEB_DEVICE_LABELS, WebDeviceLabel } from '../device-labels';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  /** Rótulo previsível do dispositivo; a Web assume `Wise Web` quando ausente. */
  @IsOptional()
  @IsIn(WEB_DEVICE_LABELS)
  deviceLabel?: WebDeviceLabel;
}
