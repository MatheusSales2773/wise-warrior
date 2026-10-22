import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsDisplayName } from '../../users/dto/display-name.decorator';
import { WEB_DEVICE_LABELS, WebDeviceLabel } from '../device-labels';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsDisplayName()
  displayName: string;

  /** Rótulo previsível do dispositivo; a Web assume `Wise Web` quando ausente. */
  @IsOptional()
  @IsIn(WEB_DEVICE_LABELS)
  deviceLabel?: WebDeviceLabel;
}
