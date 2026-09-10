import { IsNotEmpty, IsString } from 'class-validator';

/** Refresh nativo: a credencial rotativa vem exclusivamente no corpo. */
export class NativeRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
