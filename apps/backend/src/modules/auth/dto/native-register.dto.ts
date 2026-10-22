import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsDisplayName } from '../../users/dto/display-name.decorator';
import { NATIVE_DEVICE_LABELS, NativeDeviceLabel } from '../device-labels';

/** Cadastro nativo: mesmos dados da conta e rótulo obrigatório iOS/Android. */
export class NativeRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsDisplayName()
  displayName: string;

  @IsIn(NATIVE_DEVICE_LABELS)
  deviceLabel: NativeDeviceLabel;
}
