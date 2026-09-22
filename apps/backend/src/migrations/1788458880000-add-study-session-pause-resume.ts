import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudySessionPauseResume1788458880000 implements MigrationInterface {
  name = 'AddStudySessionPauseResume1788458880000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE study_sessions
      ADD paused_total_milliseconds bigint unsigned NOT NULL DEFAULT 0 AFTER paused_total_seconds`);
    await queryRunner.query(`UPDATE study_sessions
      SET paused_total_milliseconds = paused_total_seconds * 1000`);
    await queryRunner.query(`CREATE TABLE study_session_transition_receipts (
      user_id varchar(36) NOT NULL,
      study_session_id varchar(36) NOT NULL,
      idempotency_key varchar(128) NOT NULL,
      action varchar(16) NOT NULL,
      expected_version int NOT NULL,
      response_json json NOT NULL,
      created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, idempotency_key),
      INDEX IDX_study_session_transition_receipts_study_session (study_session_id),
      CONSTRAINT FK_study_session_transition_receipts_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT FK_study_session_transition_receipts_study
        FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE study_session_transition_receipts');
    await queryRunner.query('ALTER TABLE study_sessions DROP COLUMN paused_total_milliseconds');
  }
}
