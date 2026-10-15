import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-011: o antifraude trunca em vez de descartar; `capped_reason` registra qual limite truncou o foco.
 * SQL direto: `study_sessions` tem coluna gerada (`active_user_id`) e o addColumn do TypeORM consulta
 * `typeorm_metadata`, que a aplicação não cria.
 */
export class AddStudySessionCappedReason1788459540000 implements MigrationInterface {
  name = 'AddStudySessionCappedReason1788459540000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions ADD COLUMN capped_reason VARCHAR(24) NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions DROP COLUMN capped_reason');
  }
}
