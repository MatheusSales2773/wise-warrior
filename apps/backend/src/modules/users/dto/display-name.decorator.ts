import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

/** A regra do nome do guerreiro, a mesma no registro e em `PATCH /users/me`: vale sobre o nome sem espaços nas pontas. */
export const IsDisplayName = () => applyDecorators(
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
  IsString(),
  MinLength(DISPLAY_NAME_MIN),
  MaxLength(DISPLAY_NAME_MAX),
);
