import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export async function rejectIfStudySessionCommandKeyUsed(
  manager: EntityManager,
  userId: string,
  idempotencyKey: string,
): Promise<void> {
  const commandKeys = await manager.query(
    'SELECT command_kind FROM study_session_command_keys WHERE user_id = ? AND idempotency_key = ?',
    [userId, idempotencyKey],
  ) as Array<{ command_kind: string }>;
  if (commandKeys[0]) {
    throw new ConflictException({
      type: 'https://wise.app/errors/idempotency-key-reused',
      message: 'Idempotency-Key já foi usada por outro comando',
    });
  }
}
