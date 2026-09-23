import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyStudySessionIdempotencyKeys1788459000000 implements MigrationInterface {
  name = 'UnifyStudySessionIdempotencyKeys1788459000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE study_session_command_keys (
      user_id varchar(36) NOT NULL,
      idempotency_key varchar(128) NOT NULL,
      command_kind varchar(16) NOT NULL,
      created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, idempotency_key),
      CONSTRAINT FK_study_session_command_keys_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await queryRunner.query(`INSERT IGNORE INTO study_session_command_keys
      (user_id, idempotency_key, command_kind)
      SELECT user_id, idempotency_key, 'start' FROM study_session_start_receipts`);
    await queryRunner.query(`INSERT IGNORE INTO study_session_command_keys
      (user_id, idempotency_key, command_kind, created_at)
      SELECT user_id, idempotency_key, action, created_at
      FROM study_session_transition_receipts`);

    // Keep writes from an older app instance in the global key scope during a rolling deployment.
    await queryRunner.query(`CREATE TRIGGER TR_study_session_start_receipt_command_key
      AFTER INSERT ON study_session_start_receipts
      FOR EACH ROW
      INSERT IGNORE INTO study_session_command_keys (user_id, idempotency_key, command_kind)
      VALUES (NEW.user_id, NEW.idempotency_key, 'start')`);
    await queryRunner.query(`CREATE TRIGGER TR_study_session_transition_receipt_command_key
      AFTER INSERT ON study_session_transition_receipts
      FOR EACH ROW
      INSERT IGNORE INTO study_session_command_keys (user_id, idempotency_key, command_kind, created_at)
      VALUES (NEW.user_id, NEW.idempotency_key, NEW.action, NEW.created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER TR_study_session_transition_receipt_command_key');
    await queryRunner.query('DROP TRIGGER TR_study_session_start_receipt_command_key');
    await queryRunner.query('DROP TABLE study_session_command_keys');
  }
}
