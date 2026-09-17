import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddStudySessionRecentIndex1788458520000 implements MigrationInterface {
  name = 'AddStudySessionRecentIndex1788458520000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('study_sessions', new TableIndex({
      name: 'IDX_study_sessions_user_id_ended_at_id',
      columnNames: ['user_id', 'ended_at', 'id'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('study_sessions', 'IDX_study_sessions_user_id_ended_at_id');
  }
}
