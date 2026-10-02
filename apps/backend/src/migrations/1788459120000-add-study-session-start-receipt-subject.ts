import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudySessionStartReceiptSubject1788459120000 implements MigrationInterface {
  name = 'AddStudySessionStartReceiptSubject1788459120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NULL is "Sem matéria". Receipts written before M6 never carried a subject, so NULL is also their truth.
    await queryRunner.query('ALTER TABLE study_session_start_receipts ADD COLUMN subject varchar(255) NULL AFTER planned_duration_seconds');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // study_sessions.subject is untouched, so every persisted Matéria (including legacy Guild rows) survives.
    await queryRunner.query('ALTER TABLE study_session_start_receipts DROP COLUMN subject');
  }
}
