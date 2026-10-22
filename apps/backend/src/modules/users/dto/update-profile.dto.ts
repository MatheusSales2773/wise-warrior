import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  /** Mesma regra do registro; não precisa ser único. */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;
}
