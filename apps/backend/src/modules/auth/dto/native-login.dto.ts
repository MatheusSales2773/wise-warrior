import { IsEmail, IsIn, IsString } from 'class-validator';
import { NATIVE_DEVICE_LABELS } from '../device-labels';

/** Login nativo: credenciais e rótulo obrigatório iOS/Android. */
export class NativeLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsIn(NATIVE_DEVICE_LABELS)
  deviceLabel: string;
}
