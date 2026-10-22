import { IsDisplayName } from './display-name.decorator';

export class UpdateProfileDto {
  /** Não precisa ser único. */
  @IsDisplayName()
  displayName: string;
}
