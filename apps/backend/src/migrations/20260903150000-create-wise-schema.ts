import {
  MigrationInterface,
  QueryRunner,
  Table,
} from 'typeorm';

const uuid = (name: string) => ({
  name,
  type: 'varchar',
  length: '36',
  isPrimary: name === 'id',
  isNullable: false,
});

const varchar = (name: string, options: { nullable?: boolean; default?: string } = {}) => ({
  name,
  type: 'varchar',
  length: '255',
  isNullable: options.nullable ?? false,
  ...(options.default === undefined ? {} : { default: options.default }),
});

const createdAt = (name: string) => ({
  name,
  type: 'datetime',
  precision: 6,
  isNullable: false,
  default: 'CURRENT_TIMESTAMP(6)',
});

export class CreateWiseSchema20260903150000 implements MigrationInterface {
  name = 'CreateWiseSchema20260903150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          varchar('email'),
          varchar('password_hash'),
          varchar('display_name'),
          varchar('plan_tier', { default: "'free'" }),
          createdAt('created_at'),
        ],
        indices: [
          { name: 'UQ_users_email', columnNames: ['email'], isUnique: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'cosmetic_items',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          varchar('category'),
          varchar('name'),
          varchar('unlock_condition'),
          { name: 'requires_premium', type: 'tinyint', width: 1, isNullable: false, default: '0' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'characters',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('user_id'),
          { name: 'level', type: 'int', isNullable: false, default: '1' },
          { name: 'xp_total', type: 'bigint', isNullable: false, default: '0' },
          varchar('title', { nullable: true }),
          { ...uuid('companion_id'), isNullable: true },
        ],
        indices: [
          { name: 'REL_c6e648aeaab79e4213def02aba', columnNames: ['user_id'], isUnique: true },
        ],
        foreignKeys: [
          {
            name: 'FK_characters_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('user_id'),
          varchar('refresh_token_hash'),
          varchar('device_label', { nullable: true }),
          varchar('user_agent', { nullable: true }),
          createdAt('created_at'),
          { name: 'last_used_at', type: 'datetime', isNullable: false },
          { name: 'revoked_at', type: 'datetime', isNullable: true },
        ],
        indices: [
          { name: 'IDX_sessions_user_id', columnNames: ['user_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_sessions_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'guilds',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          varchar('name'),
          { name: 'level', type: 'int', isNullable: false, default: '1' },
          uuid('created_by'),
          createdAt('created_at'),
        ],
        indices: [
          { name: 'UQ_guilds_name', columnNames: ['name'], isUnique: true },
          { name: 'IDX_guilds_created_by', columnNames: ['created_by'] },
        ],
        foreignKeys: [
          {
            name: 'FK_guilds_created_by_users',
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'guild_memberships',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('guild_id'),
          uuid('user_id'),
          varchar('role', { default: "'member'" }),
          createdAt('joined_at'),
        ],
        indices: [
          {
            name: 'UQ_guild_memberships_guild_id_user_id',
            columnNames: ['guild_id', 'user_id'],
            isUnique: true,
          },
          { name: 'IDX_guild_memberships_user_id', columnNames: ['user_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_guild_memberships_guild_id_guilds',
            columnNames: ['guild_id'],
            referencedTableName: 'guilds',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_guild_memberships_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'raids',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('guild_id'),
          varchar('title'),
          { name: 'goal_xp', type: 'int', isNullable: false },
          { name: 'progress_xp', type: 'int', isNullable: false, default: '0' },
          { name: 'starts_at', type: 'datetime', isNullable: false },
          { name: 'ends_at', type: 'datetime', isNullable: false },
          varchar('status', { default: "'active'" }),
        ],
        indices: [
          { name: 'IDX_raids_guild_id', columnNames: ['guild_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_raids_guild_id_guilds',
            columnNames: ['guild_id'],
            referencedTableName: 'guilds',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'study_sessions',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('user_id'),
          varchar('subject'),
          varchar('mode'),
          { ...uuid('raid_id'), isNullable: true },
          createdAt('started_at'),
          { name: 'ended_at', type: 'datetime', isNullable: true },
          { name: 'last_heartbeat_at', type: 'datetime', isNullable: true },
          { name: 'duration_valid_seconds', type: 'int', isNullable: false, default: '0' },
          { name: 'xp_awarded', type: 'int', isNullable: false, default: '0' },
          varchar('discarded_reason', { nullable: true }),
        ],
        indices: [
          {
            name: 'IDX_study_sessions_user_id_started_at',
            columnNames: ['user_id', 'started_at'],
          },
          { name: 'IDX_study_sessions_raid_id', columnNames: ['raid_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_study_sessions_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_study_sessions_raid_id_raids',
            columnNames: ['raid_id'],
            referencedTableName: 'raids',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_cosmetic_items',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('user_id'),
          uuid('cosmetic_item_id'),
          { name: 'equipped', type: 'tinyint', width: 1, isNullable: false, default: '0' },
          createdAt('unlocked_at'),
        ],
        indices: [
          {
            name: 'UQ_user_cosmetic_items_user_id_cosmetic_item_id',
            columnNames: ['user_id', 'cosmetic_item_id'],
            isUnique: true,
          },
          {
            name: 'IDX_user_cosmetic_items_cosmetic_item_id',
            columnNames: ['cosmetic_item_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_user_cosmetic_items_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_user_cosmetic_items_cosmetic_item_id_cosmetic_items',
            columnNames: ['cosmetic_item_id'],
            referencedTableName: 'cosmetic_items',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'raid_contributions',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('raid_id'),
          uuid('user_id'),
          { ...uuid('study_session_id'), isNullable: true },
          { name: 'xp_contributed', type: 'int', isNullable: false },
          createdAt('created_at'),
        ],
        indices: [
          {
            name: 'IDX_raid_contributions_raid_id_user_id',
            columnNames: ['raid_id', 'user_id'],
          },
          { name: 'IDX_raid_contributions_user_id', columnNames: ['user_id'] },
          {
            name: 'IDX_raid_contributions_study_session_id',
            columnNames: ['study_session_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_raid_contributions_raid_id_raids',
            columnNames: ['raid_id'],
            referencedTableName: 'raids',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_raid_contributions_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_raid_contributions_study_session_id_study_sessions',
            columnNames: ['study_session_id'],
            referencedTableName: 'study_sessions',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'guild_chat_messages',
        engine: 'InnoDB',
        columns: [
          uuid('id'),
          uuid('guild_id'),
          uuid('user_id'),
          { name: 'body', type: 'text', isNullable: false },
          createdAt('sent_at'),
        ],
        indices: [
          { name: 'IDX_guild_chat_messages_guild_id', columnNames: ['guild_id'] },
          { name: 'IDX_guild_chat_messages_user_id', columnNames: ['user_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_guild_chat_messages_guild_id_guilds',
            columnNames: ['guild_id'],
            referencedTableName: 'guilds',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_guild_chat_messages_user_id_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'guild_chat_messages',
      'raid_contributions',
      'user_cosmetic_items',
      'study_sessions',
      'sessions',
      'raids',
      'guild_memberships',
      'characters',
      'guilds',
      'cosmetic_items',
      'users',
    ]) {
      await queryRunner.dropTable(table, true);
    }
  }
}
