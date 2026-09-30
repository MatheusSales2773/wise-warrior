import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudySessionEndedAtPrecision1788459060000 implements MigrationInterface {
  name = 'AddStudySessionEndedAtPrecision1788459060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions MODIFY ended_at datetime(3) NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE study_sessions MODIFY ended_at datetime NULL');
  }
}
