import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NATIVE_DEVICE_LABELS } from '../device-labels';

/** Cadastro nativo: mesmos dados da conta e rótulo obrigatório iOS/Android. */
export class NativeRegisterDto {
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

  @IsIn(NATIVE_DEVICE_LABELS)
  deviceLabel: string;
}
