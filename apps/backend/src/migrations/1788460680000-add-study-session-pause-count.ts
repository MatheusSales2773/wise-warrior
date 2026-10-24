import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forja v2 (#318): `pause_count` guarda quantas pausas a Study Session aplicou, para o número ser o mesmo em todos
 * os dispositivos. Sessões existentes começam em 0. SQL direto: ver a nota em `add-study-session-capped-reason`.
 */
export class AddStudySessionPauseCount1788460680000 implements MigrationInterface {
  name = 'AddStudySessionPauseCount1788460680000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions ADD COLUMN pause_count int NOT NULL DEFAULT 0');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions DROP COLUMN pause_count');
  }
}
