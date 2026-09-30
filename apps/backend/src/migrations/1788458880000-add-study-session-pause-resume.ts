import { MigrationInterface, QueryRunner } from 'typeorm';

const TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE = 'study_session_transition_receipts_downgrade_archive';

export class AddStudySessionPauseResume1788458880000 implements MigrationInterface {
  name = 'AddStudySessionPauseResume1788458880000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE study_sessions
      ADD paused_total_milliseconds bigint unsigned NOT NULL DEFAULT 0 AFTER paused_total_seconds`);
    await queryRunner.query(`UPDATE study_sessions
      SET paused_total_milliseconds = paused_total_seconds * 1000`);
    if (!await this.tableExists(queryRunner, 'study_session_transition_receipts')) {
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
    if (await this.tableExists(queryRunner, TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE)) {
      await queryRunner.query(`INSERT IGNORE INTO study_session_transition_receipts
        (user_id, study_session_id, idempotency_key, action, expected_version, response_json, created_at)
        SELECT archived.user_id, archived.study_session_id, archived.idempotency_key,
          archived.action, archived.expected_version, archived.response_json, archived.created_at
        FROM ${TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE} archived
        INNER JOIN users ON users.id = archived.user_id
        INNER JOIN study_sessions ON study_sessions.id = archived.study_session_id
          AND study_sessions.user_id = archived.user_id`);
      await queryRunner.query(`DROP TABLE ${TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ receiptCount }] = await queryRunner.query(
      'SELECT COUNT(*) AS receiptCount FROM study_session_transition_receipts',
    ) as [{ receiptCount: number | string }];
    if (Number(receiptCount) > 0) {
      if (!await this.tableExists(queryRunner, TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE)) {
        await queryRunner.query(
          `CREATE TABLE ${TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE} LIKE study_session_transition_receipts`,
        );
      }
      await queryRunner.query(`INSERT IGNORE INTO ${TRANSITION_RECEIPTS_ROLLBACK_ARCHIVE}
        (user_id, study_session_id, idempotency_key, action, expected_version, response_json, created_at)
        SELECT user_id, study_session_id, idempotency_key, action, expected_version, response_json, created_at
        FROM study_session_transition_receipts`);
    }
    await queryRunner.query('DROP TABLE study_session_transition_receipts');
    await queryRunner.query('ALTER TABLE study_sessions DROP COLUMN paused_total_milliseconds');
  }

  private async tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const [{ count }] = await queryRunner.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
      [tableName],
    ) as [{ count: number | string }];
    return Number(count) > 0;
  }
}
