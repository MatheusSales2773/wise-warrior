import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foco livre (#292): `kind` separa o Ciclo do Foco livre. O Foco livre grava `planned_duration_seconds = NULL`, mas
 * `NULL` não discrimina, porque há sessões legadas sem duração planejada; por isso a coluna própria. O recibo de
 * início também passa a aceitar duração nula. SQL direto: ver a nota em `add-study-session-capped-reason`.
 */
export class AddStudySessionKind1788460500000 implements MigrationInterface {
  name = 'AddStudySessionKind1788460500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE study_sessions ADD COLUMN kind VARCHAR(8) NOT NULL DEFAULT 'cycle'");
    await queryRunner.query('ALTER TABLE study_session_start_receipts MODIFY planned_duration_seconds int NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Um Foco livre não cabe no esquema anterior (sem duração planejada); o recibo é descartado, a sessão fica sem ciclo.
    await queryRunner.query('DELETE FROM study_session_start_receipts WHERE planned_duration_seconds IS NULL');
    await queryRunner.query('UPDATE study_sessions SET planned_duration_seconds = 1500 WHERE kind = ? AND planned_duration_seconds IS NULL', ['free']);
    await queryRunner.query('ALTER TABLE study_session_start_receipts MODIFY planned_duration_seconds int NOT NULL');
    await queryRunner.query('ALTER TABLE study_sessions DROP COLUMN kind');
  }
}
