import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanonicalStudySessionStart1788458760000 implements MigrationInterface {
  name = 'AddCanonicalStudySessionStart1788458760000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions MODIFY subject varchar(255) NULL');
    await queryRunner.query(`ALTER TABLE study_sessions
      ADD planned_duration_seconds int NULL,
      ADD state varchar(24) NULL,
      ADD run_deadline_at datetime(3) NULL,
      ADD paused_at datetime(3) NULL,
      ADD paused_total_seconds int NOT NULL DEFAULT 0,
      ADD version int NOT NULL DEFAULT 1,
      ADD terminal_reason varchar(120) NULL,
      ADD initiating_session_id varchar(36) NULL`);

    // Legacy unfinished rows cannot be assigned to a particular authenticated Session.
    await queryRunner.query(`UPDATE study_sessions
      SET state = IF(ended_at IS NULL, 'discarded', IF(discarded_reason IS NULL, 'completed', 'discarded')),
          terminal_reason = IF(ended_at IS NULL, 'legacy-session-without-owner', NULL),
          ended_at = COALESCE(ended_at, NOW(3))`);
    await queryRunner.query(`ALTER TABLE study_sessions
      ADD active_user_id varchar(36)
        GENERATED ALWAYS AS (CASE WHEN state IN ('running', 'paused') THEN user_id ELSE NULL END) VIRTUAL,
      ADD UNIQUE KEY UQ_study_sessions_active_user (active_user_id)`);
    await queryRunner.query(`CREATE TABLE active_study_sessions (
      user_id varchar(36) NOT NULL PRIMARY KEY,
      study_session_id varchar(36) NOT NULL UNIQUE,
      CONSTRAINT FK_active_study_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT FK_active_study_sessions_study FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE study_session_start_receipts (
      user_id varchar(36) NOT NULL,
      idempotency_key varchar(128) NOT NULL,
      planned_duration_seconds int NOT NULL,
      initiating_session_id varchar(36) NOT NULL,
      response_json json NOT NULL,
      PRIMARY KEY (user_id, idempotency_key),
      CONSTRAINT FK_study_session_start_receipts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query('SELECT COUNT(*) AS count FROM study_sessions WHERE subject IS NULL') as [{ count: number | string }];
    if (Number(count) > 0) {
      throw new Error('Cannot revert Study Session schema while sessions without a subject exist');
    }
    await queryRunner.query('DROP TABLE study_session_start_receipts');
    await queryRunner.query('DROP TABLE active_study_sessions');
    await queryRunner.query('ALTER TABLE study_sessions DROP INDEX UQ_study_sessions_active_user, DROP COLUMN active_user_id');
    await queryRunner.query(`ALTER TABLE study_sessions
      DROP COLUMN planned_duration_seconds,
      DROP COLUMN state,
      DROP COLUMN run_deadline_at,
      DROP COLUMN paused_at,
      DROP COLUMN paused_total_seconds,
      DROP COLUMN version,
      DROP COLUMN terminal_reason,
      DROP COLUMN initiating_session_id`);
    await queryRunner.query('ALTER TABLE study_sessions MODIFY subject varchar(255) NOT NULL');
  }
}
