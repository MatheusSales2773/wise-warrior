import type { Connection, RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  type IntegrationDatabase,
} from '../test/integration-database';
import { CreateWiseSchema1788458400000 } from './1788458400000-create-wise-schema';

const expectedTables = [
  'users',
  'characters',
  'cosmetic_items',
  'user_cosmetic_items',
  'sessions',
  'session_refresh_token_history',
  'guilds',
  'guild_memberships',
  'raids',
  'study_sessions',
  'raid_contributions',
  'guild_chat_messages',
];

const expectedColumns: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'display_name', 'plan_tier', 'created_at'],
  characters: ['id', 'user_id', 'level', 'xp_total', 'title', 'companion_id'],
  cosmetic_items: ['id', 'category', 'name', 'unlock_condition', 'requires_premium'],
  user_cosmetic_items: ['id', 'user_id', 'cosmetic_item_id', 'equipped', 'unlocked_at'],
  sessions: [
    'id',
    'user_id',
    'refresh_token_hash',
    'device_label',
    'user_agent',
    'created_at',
    'last_used_at',
    'revoked_at',
  ],
  session_refresh_token_history: [
    'session_id',
    'token_hash',
    'consumed_at',
    'retain_until',
  ],
  guilds: ['id', 'name', 'level', 'created_by', 'created_at'],
  guild_memberships: ['id', 'guild_id', 'user_id', 'role', 'joined_at'],
  raids: ['id', 'guild_id', 'title', 'goal_xp', 'progress_xp', 'starts_at', 'ends_at', 'status'],
  study_sessions: [
    'id',
    'user_id',
    'subject',
    'mode',
    'raid_id',
    'started_at',
    'ended_at',
    'last_heartbeat_at',
    'duration_valid_seconds',
    'xp_awarded',
    'discarded_reason',
  ],
  raid_contributions: [
    'id',
    'raid_id',
    'user_id',
    'study_session_id',
    'xp_contributed',
    'created_at',
  ],
  guild_chat_messages: ['id', 'guild_id', 'user_id', 'body', 'sent_at'],
};

type SchemaRow = RowDataPacket & Record<string, string | number>;

async function rows(connection: Connection, sql: string, values: unknown[] = []): Promise<SchemaRow[]> {
  const [result] = await connection.query(sql, values);
  return result as SchemaRow[];
}

describe('TypeORM migrations against an empty MySQL schema', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let initialDataSource: DataSource | undefined;

  afterEach(async () => {
    try {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
      if (initialDataSource?.isInitialized) {
        await initialDataSource.destroy();
      }
    } finally {
      await database?.close();
    }
  });

  it('creates, inspects, and reverts the complete schema', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));

    await dataSource.initialize();
    await dataSource.runMigrations();

    const schemaLog = await dataSource.driver.createSchemaBuilder().log();
    expect(schemaLog.upQueries).toEqual([]);

    const tableRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(tableRows.map((row) => row.TABLE_NAME)).toEqual([
      ...expectedTables.slice().sort(),
      'migrations',
    ].sort());

    for (const tableName of expectedTables) {
      const columnRows = await rows(
        database!.admin,
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [database!.name, tableName],
      );
      expect(columnRows.map((row) => row.COLUMN_NAME)).toEqual(expectedColumns[tableName]);

      const primaryKeyRows = await rows(
        database!.admin,
        `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
         ORDER BY ORDINAL_POSITION`,
        [database!.name, tableName],
      );
      expect(primaryKeyRows.map((row) => row.COLUMN_NAME)).toEqual(
        tableName === 'session_refresh_token_history'
          ? ['session_id', 'token_hash']
          : ['id'],
      );
    }

    const uniqueRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND NON_UNIQUE = 0 AND TABLE_NAME <> 'migrations'
       GROUP BY TABLE_NAME, INDEX_NAME
       ORDER BY TABLE_NAME, INDEX_NAME`,
      [database!.name],
    );
    const expectedUniques = [
      ['users', 'UQ_users_email', 'email'],
      ['guilds', 'UQ_guilds_name', 'name'],
      ['characters', 'REL_c6e648aeaab79e4213def02aba', 'user_id'],
      [
        'guild_memberships',
        'UQ_guild_memberships_guild_id_user_id',
        'guild_id,user_id',
      ],
      [
        'user_cosmetic_items',
        'UQ_user_cosmetic_items_user_id_cosmetic_item_id',
        'user_id,cosmetic_item_id',
      ],
    ];
    for (const expected of expectedUniques) {
      expect(uniqueRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            TABLE_NAME: expected[0],
            INDEX_NAME: expected[1],
            COLUMNS: expected[2],
          }),
        ]),
      );
    }

    const criticalIndexRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND NON_UNIQUE = 1
       GROUP BY TABLE_NAME, INDEX_NAME`,
      [database!.name],
    );
    for (const expected of [
      ['study_sessions', 'IDX_study_sessions_user_id_started_at', 'user_id,started_at'],
      ['study_sessions', 'IDX_study_sessions_user_id_ended_at_id', 'user_id,ended_at,id'],
      ['raid_contributions', 'IDX_raid_contributions_raid_id_user_id', 'raid_id,user_id'],
      ['sessions', 'IDX_sessions_user_id', 'user_id'],
      [
        'session_refresh_token_history',
        'IDX_session_refresh_token_history_session_id_retain_until',
        'session_id,retain_until',
      ],
      ['guild_chat_messages', 'IDX_guild_chat_messages_guild_id', 'guild_id'],
    ]) {
      expect(criticalIndexRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            TABLE_NAME: expected[0],
            INDEX_NAME: expected[1],
            COLUMNS: expected[2],
          }),
        ]),
      );
    }

    await database!.admin.query(
      `INSERT INTO ${database!.identifier}.users
       (id, email, password_hash, display_name, plan_tier)
       VALUES (?, ?, ?, ?, ?)`,
      ['00000000-0000-4000-8000-000000000001', 'explain@example.com', 'hash', 'Explain', 'free'],
    );
    await database!.admin.query(
      `INSERT INTO ${database!.identifier}.study_sessions
       (id, user_id, subject, mode, started_at, ended_at,
        duration_valid_seconds, xp_awarded)
       SELECT UUID(), ?, 'Explain', 'solo', NOW() - INTERVAL 2 HOUR,
              NOW() - INTERVAL 1 HOUR, 3600, 10
       FROM (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
             UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
             UNION ALL SELECT 9 UNION ALL SELECT 10) a
       CROSS JOIN (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                   UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
                   UNION ALL SELECT 9 UNION ALL SELECT 10) b
       CROSS JOIN (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                   UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
                   UNION ALL SELECT 9 UNION ALL SELECT 10) c`,
      ['00000000-0000-4000-8000-000000000001'],
    );

    const explainRows = await rows(
      database!.admin,
      `EXPLAIN SELECT id, subject, mode, started_at, ended_at,
                      duration_valid_seconds, xp_awarded, discarded_reason
       FROM ${database!.identifier}.study_sessions
       WHERE user_id = ? AND ended_at IS NOT NULL
       ORDER BY ended_at DESC, id DESC LIMIT 5`,
      ['00000000-0000-4000-8000-000000000001'],
    );
    expect(explainRows[0]?.key).toBe('IDX_study_sessions_user_id_ended_at_id');

    const foreignKeyRows = await rows(
      database!.admin,
      `SELECT kcu.CONSTRAINT_NAME, kcu.TABLE_NAME, kcu.COLUMN_NAME,
              kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
              rc.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE kcu
       JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
         ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
       WHERE kcu.CONSTRAINT_SCHEMA = ?
       ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME`,
      [database!.name],
    );
    const expectedForeignKeys = [
      ['FK_characters_user_id_users', 'characters', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_sessions_user_id_users', 'sessions', 'user_id', 'users', 'id', 'CASCADE'],
      [
        'FK_session_refresh_token_history_session_id_sessions',
        'session_refresh_token_history',
        'session_id',
        'sessions',
        'id',
        'CASCADE',
      ],
      ['FK_guilds_created_by_users', 'guilds', 'created_by', 'users', 'id', 'CASCADE'],
      ['FK_guild_memberships_guild_id_guilds', 'guild_memberships', 'guild_id', 'guilds', 'id', 'CASCADE'],
      ['FK_guild_memberships_user_id_users', 'guild_memberships', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_raids_guild_id_guilds', 'raids', 'guild_id', 'guilds', 'id', 'CASCADE'],
      ['FK_study_sessions_user_id_users', 'study_sessions', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_study_sessions_raid_id_raids', 'study_sessions', 'raid_id', 'raids', 'id', 'SET NULL'],
      ['FK_raid_contributions_raid_id_raids', 'raid_contributions', 'raid_id', 'raids', 'id', 'CASCADE'],
      ['FK_raid_contributions_user_id_users', 'raid_contributions', 'user_id', 'users', 'id', 'CASCADE'],
      [
        'FK_raid_contributions_study_session_id_study_sessions',
        'raid_contributions',
        'study_session_id',
        'study_sessions',
        'id',
        'SET NULL',
      ],
      ['FK_guild_chat_messages_guild_id_guilds', 'guild_chat_messages', 'guild_id', 'guilds', 'id', 'CASCADE'],
      ['FK_guild_chat_messages_user_id_users', 'guild_chat_messages', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_user_cosmetic_items_user_id_users', 'user_cosmetic_items', 'user_id', 'users', 'id', 'CASCADE'],
      [
        'FK_user_cosmetic_items_cosmetic_item_id_cosmetic_items',
        'user_cosmetic_items',
        'cosmetic_item_id',
        'cosmetic_items',
        'id',
        'CASCADE',
      ],
    ];
    expect(foreignKeyRows).toHaveLength(expectedForeignKeys.length);
    for (const expected of expectedForeignKeys) {
      expect(foreignKeyRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            CONSTRAINT_NAME: expected[0],
            TABLE_NAME: expected[1],
            COLUMN_NAME: expected[2],
            REFERENCED_TABLE_NAME: expected[3],
            REFERENCED_COLUMN_NAME: expected[4],
            DELETE_RULE: expected[5],
          }),
        ]),
      );
    }

    const migrationRows = await rows(
      database!.admin,
      `SELECT name FROM ${database!.identifier}.migrations`,
    );
    expect(migrationRows.map((row) => row.name)).toEqual([
      'CreateWiseSchema1788458400000',
      'AddSessionRefreshTokenHistory1788458460000',
      'AddStudySessionRecentIndex1788458520000',
    ]);

    await dataSource.undoLastMigration();
    const remainingRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(remainingRows.map((row) => row.TABLE_NAME)).toEqual(
      expectedTables.slice().sort(),
    );

    await dataSource.undoLastMigration();
    const afterHistoryRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(afterHistoryRevertRows.map((row) => row.TABLE_NAME)).toEqual(
      expectedTables
        .filter((tableName) => tableName !== 'session_refresh_token_history')
        .sort(),
    );

    await dataSource.undoLastMigration();
    const emptyRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations'`,
      [database!.name],
    );
    expect(emptyRows).toEqual([]);
  });

  it('adds the history table without invalidating an existing session', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(
      database.options([CreateWiseSchema1788458400000]),
    );
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    await database.admin.query(
      `INSERT INTO ${database.identifier}.users
       (id, email, password_hash, display_name, plan_tier)
       VALUES (?, ?, ?, ?, ?)`,
      ['existing-user', 'existing@example.com', 'hash', 'Existing', 'free'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.sessions
       (id, user_id, refresh_token_hash, last_used_at)
       VALUES (?, ?, ?, ?)`,
      ['existing-session', 'existing-user', 'hash-only', new Date()],
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const sessionRows = await rows(
      database.admin,
      `SELECT id, refresh_token_hash FROM ${database.identifier}.sessions`,
    );
    expect(sessionRows).toEqual([
      expect.objectContaining({ id: 'existing-session', refresh_token_hash: 'hash-only' }),
    ]);

    const historyTableRows = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'session_refresh_token_history'`,
      [database.name],
    );
    expect(historyTableRows).toHaveLength(1);
  });
});
