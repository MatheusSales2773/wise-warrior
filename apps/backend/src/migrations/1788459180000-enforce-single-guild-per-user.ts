import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class EnforceSingleGuildPerUser1788459180000 implements MigrationInterface {
  name = 'EnforceSingleGuildPerUser1788459180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A user belongs to at most one Guild. Rows created before this rule keep only the oldest membership.
    await queryRunner.query(`
      DELETE m FROM guild_memberships m
      JOIN guild_memberships older
        ON older.user_id = m.user_id
       AND (older.joined_at < m.joined_at OR (older.joined_at = m.joined_at AND older.id < m.id))
    `);
    // The foreign key on user_id needs an index at every step, so the unique one is created before the old one is dropped.
    await queryRunner.createIndex('guild_memberships', new TableIndex({
      name: 'UQ_guild_memberships_user_id',
      columnNames: ['user_id'],
      isUnique: true,
    }));
    await queryRunner.dropIndex('guild_memberships', 'IDX_guild_memberships_user_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('guild_memberships', new TableIndex({
      name: 'IDX_guild_memberships_user_id',
      columnNames: ['user_id'],
    }));
    await queryRunner.dropIndex('guild_memberships', 'UQ_guild_memberships_user_id');
  }
}
