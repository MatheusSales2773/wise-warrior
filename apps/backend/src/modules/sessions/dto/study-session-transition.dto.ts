import { IsInt, Min } from 'class-validator';

export class StudySessionTransitionDto {
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
