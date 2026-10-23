import type { Connection, RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  migrationsBefore,
  migrationsThrough,
  revertThrough,
  type IntegrationDatabase,
} from '../test/integration-database';
import { CreateWiseSchema1788458400000 } from './1788458400000-create-wise-schema';
import { AddSessionRefreshTokenHistory1788458460000 } from './1788458460000-add-session-refresh-token-history';
import { AddCanonicalStudySessionStart1788458760000 } from './1788458760000-add-canonical-study-session-start';
import { AddStudySessionPauseResume1788458880000 } from './1788458880000-add-study-session-pause-resume';
import { UnifyStudySessionIdempotencyKeys1788459000000 } from './1788459000000-unify-study-session-idempotency-keys';
import { AddStudySessionStartReceiptSubject1788459120000 } from './1788459120000-add-study-session-start-receipt-subject';
import { AddStudySessionEndedAtPrecision1788459060000 } from './1788459060000-add-study-session-ended-at-precision';
import { EnforceSingleGuildPerUser1788459180000 } from './1788459180000-enforce-single-guild-per-user';
import { SeedInitialCosmeticItems1788459240000 } from './1788459240000-seed-initial-cosmetic-items';
import { DropCharacterTitle1788459300000 } from './1788459300000-drop-character-title';
import { AddRaidMissions1788459360000 } from './1788459360000-add-raid-missions';
import { AddRaidParticipations1788459420000 } from './1788459420000-add-raid-participations';
import { AddRaidGoalReachedAt1788459480000 } from './1788459480000-add-raid-goal-reached-at';
import { AddGuildChatMessageSequence1788459540000 } from './1788459540000-add-guild-chat-message-sequence';
import { AddCoinEconomy1788459660000 } from './1788459660000-add-coin-economy';
import { GrantWelcomeCoins1788459720000 } from './1788459720000-grant-welcome-coins';
import { AddMissionStore1788459780000 } from './1788459780000-add-mission-store';
import { AddCosmeticItemSale1788459840000 } from './1788459840000-add-cosmetic-item-sale';
import { AddMissionRewardItems1788459960000 } from './1788459960000-add-mission-reward-items';
import { AddGuildMissionChoice1788460020000 } from './1788460020000-add-guild-mission-choice';
import { KeepBadgesOffSale1788460080000 } from './1788460080000-keep-badges-off-sale';
import { SeedCosmeticItemsForSale1788460140000 } from './1788460140000-seed-cosmetic-items-for-sale';
import { SeedMissionsForSale1788460200000 } from './1788460200000-seed-missions-for-sale';
import { AddWeaponCategory1788460440000, STAFF_ID } from './1788460440000-add-weapon-category';
import { AddStudySessionKind1788460500000 } from './1788460500000-add-study-session-kind';
import { saoPauloWeekAt } from '../shared/time/sao-paulo-calendar';

const ITEMS_FOR_SALE = [
  ['c05e71c0-0000-4000-8000-000000000101', 'Marcador de Fita', 30, 'accessory'],
  ['c05e71c0-0000-4000-8000-000000000102', 'Guardião das Páginas', 45, 'title'],
  ['c05e71c0-0000-4000-8000-000000000103', 'Pena do Escriba', 60, 'accessory'],
  ['c05e71c0-0000-4000-8000-000000000104', 'Andarilho do Saber', 90, 'title'],
  ['c05e71c0-0000-4000-8000-000000000105', 'Túnica do Viajante', 120, 'avatar'],
  ['c05e71c0-0000-4000-8000-000000000106', 'Lanterna do Vigia', 180, 'accessory'],
  ['c05e71c0-0000-4000-8000-000000000107', 'Arquimago dos Prazos', 240, 'title'],
  ['c05e71c0-0000-4000-8000-000000000108', 'Manto Estelar', 300, 'avatar'],
] as const;

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
  'active_study_sessions',
  'study_session_start_receipts',
  'study_session_transition_receipts',
  'study_session_command_keys',
  'raid_contributions',
  'guild_chat_messages',
  'raid_participations',
  'coin_balances',
  'coin_ledger_entries',
  'mission_reward_items',
  'user_missions',
  'guild_mission_choices',
];

/** The tables that exist before the coin economy migration; the revert steps after it check these. */
const tablesBeforeCoinEconomy = expectedTables.filter(
  (tableName) => !['coin_balances', 'coin_ledger_entries', 'mission_reward_items', 'user_missions', 'guild_mission_choices'].includes(tableName),
);

const expectedColumns: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'display_name', 'plan_tier', 'created_at'],
  characters: ['id', 'user_id', 'level', 'xp_total', 'companion_id'],
  cosmetic_items: ['id', 'category', 'name', 'unlock_condition', 'requires_premium', 'price', 'for_sale'],
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
  raids: ['id', 'guild_id', 'mission_id', 'goal_xp', 'progress_xp', 'starts_at', 'ends_at', 'status', 'goal_reached_at'],
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
    'planned_duration_seconds',
    'state',
    'run_deadline_at',
    'paused_at',
    'paused_total_seconds',
    'paused_total_milliseconds',
    'version',
    'terminal_reason',
    'initiating_session_id',
    'active_user_id',
    'capped_reason',
  ],
  active_study_sessions: ['user_id', 'study_session_id'],
  study_session_start_receipts: ['user_id', 'idempotency_key', 'planned_duration_seconds', 'subject', 'initiating_session_id', 'response_json'],
  study_session_transition_receipts: ['user_id', 'study_session_id', 'idempotency_key', 'action', 'expected_version', 'response_json', 'created_at'],
  study_session_command_keys: ['user_id', 'idempotency_key', 'command_kind', 'created_at'],
  raid_contributions: [
    'id',
    'raid_id',
    'user_id',
    'study_session_id',
    'xp_contributed',
    'created_at',
  ],
  guild_chat_messages: ['id', 'guild_id', 'user_id', 'body', 'sent_at', 'seq'],
  raid_participations: ['id', 'raid_id', 'user_id', 'created_at'],
  mission_reward_items: ['mission_id', 'cosmetic_item_id'],
  coin_balances: ['user_id', 'balance', 'updated_at'],
  coin_ledger_entries: ['id', 'user_id', 'amount', 'balance_after', 'origin_type', 'origin_ref', 'created_at'],
  user_missions: ['id', 'user_id', 'mission_id', 'acquired_at'],
  guild_mission_choices: ['guild_id', 'mission_id', 'owner_user_id', 'chosen_at'],
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

  it('applies every migration in order and reverts them all down to an empty schema', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const appliedRows = await rows(database.admin, `SELECT name FROM ${database.identifier}.migrations ORDER BY id`);
    expect(appliedRows.map((row) => row.name)).toEqual(APPLICATION_MIGRATIONS.map((migration) => migration.name));

    await revertThrough(dataSource, APPLICATION_MIGRATIONS[0]!);
    const leftoverRows = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations'`,
      [database.name],
    );
    expect(leftoverRows).toEqual([]);
  });

  // Pinned at the last migration this snapshot describes, so a newer migration needs no edit here.
  it('creates, inspects, and reverts the schema as of the Missões for sale seed', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(migrationsThrough(SeedMissionsForSale1788460200000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const tableRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(tableRows.map((row) => row.TABLE_NAME)).toEqual([
      ...expectedTables.slice().sort(),
      'missions',
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
          : tableName === 'mission_reward_items'
            ? ['mission_id', 'cosmetic_item_id']
          : tableName === 'study_session_start_receipts'
            ? ['user_id', 'idempotency_key']
          : tableName === 'study_session_transition_receipts'
            ? ['user_id', 'idempotency_key']
            : tableName === 'study_session_command_keys'
              ? ['user_id', 'idempotency_key']
            : tableName === 'active_study_sessions'
              ? ['user_id']
              : tableName === 'coin_balances'
                ? ['user_id']
                : tableName === 'guild_mission_choices'
                  ? ['guild_id']
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
      ['study_sessions', 'UQ_study_sessions_active_user', 'active_user_id'],
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
      ['raid_contributions', 'UQ_raid_contributions_study_session_id', 'study_session_id'],
      ['raid_participations', 'UQ_raid_participations_raid_id_user_id', 'raid_id,user_id'],
      ['user_missions', 'UQ_user_missions_user_id_mission_id', 'user_id,mission_id'],
      [
        'coin_ledger_entries',
        'UQ_coin_ledger_entries_user_id_origin_type_origin_ref',
        'user_id,origin_type,origin_ref',
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
      ['raid_participations', 'IDX_raid_participations_user_id', 'user_id'],
      ['guild_chat_messages', 'IDX_guild_chat_messages_guild_id', 'guild_id'],
      ['coin_ledger_entries', 'IDX_coin_ledger_entries_user_id_created_at_id', 'user_id,created_at,id'],
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
      ['FK_active_study_sessions_user', 'active_study_sessions', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_active_study_sessions_study', 'active_study_sessions', 'study_session_id', 'study_sessions', 'id', 'CASCADE'],
      ['FK_study_session_start_receipts_user', 'study_session_start_receipts', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_study_session_transition_receipts_user', 'study_session_transition_receipts', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_study_session_transition_receipts_study', 'study_session_transition_receipts', 'study_session_id', 'study_sessions', 'id', 'CASCADE'],
      ['FK_study_session_command_keys_user', 'study_session_command_keys', 'user_id', 'users', 'id', 'CASCADE'],
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
      ['FK_raids_mission_id_missions', 'raids', 'mission_id', 'missions', 'id', 'RESTRICT'],
      ['FK_mission_reward_items_mission_id_missions', 'mission_reward_items', 'mission_id', 'missions', 'id', 'CASCADE'],
      ['FK_mission_reward_items_cosmetic_item_id_cosmetic_items', 'mission_reward_items', 'cosmetic_item_id', 'cosmetic_items', 'id', 'RESTRICT'],
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
      ['FK_raid_participations_raid_id_raids', 'raid_participations', 'raid_id', 'raids', 'id', 'CASCADE'],
      ['FK_raid_participations_user_id_users', 'raid_participations', 'user_id', 'users', 'id', 'CASCADE'],
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
      ['FK_user_missions_user_id_users', 'user_missions', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_user_missions_mission_id_missions', 'user_missions', 'mission_id', 'missions', 'id', 'CASCADE'],
      ['FK_guild_mission_choices_guild_id_guilds', 'guild_mission_choices', 'guild_id', 'guilds', 'id', 'CASCADE'],
      ['FK_guild_mission_choices_mission_id_missions', 'guild_mission_choices', 'mission_id', 'missions', 'id', 'CASCADE'],
      ['FK_guild_mission_choices_owner_user_id_users', 'guild_mission_choices', 'owner_user_id', 'users', 'id', 'CASCADE'],
      ['FK_coin_balances_user_id_users', 'coin_balances', 'user_id', 'users', 'id', 'CASCADE'],
      ['FK_coin_ledger_entries_user_id_users', 'coin_ledger_entries', 'user_id', 'users', 'id', 'CASCADE'],
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
    const badgeInsert = (id: string, forSale: number) =>
      database!.admin.query(
        `INSERT INTO ${database!.identifier}.cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
         VALUES (?, 'badge', ?, 'purchase', 0, 100, ?)`,
        [id, id, forSale],
      );
    await expect(badgeInsert('badge-for-sale', 1)).rejects.toThrow(/CHK_cosmetic_items_for_sale/);
    await badgeInsert('badge-off-sale', 0);
    await expect(
      database!.admin.query(`UPDATE ${database!.identifier}.cosmetic_items SET for_sale = 1 WHERE id = 'badge-off-sale'`),
    ).rejects.toThrow(/CHK_cosmetic_items_for_sale/);
    await database!.admin.query(
      `INSERT INTO ${database!.identifier}.cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES ('accessory-for-sale', 'accessory', 'accessory-for-sale', 'purchase', 0, 100, 1)`,
    );
    await database!.admin.query(`DELETE FROM ${database!.identifier}.cosmetic_items WHERE id IN ('badge-off-sale', 'accessory-for-sale')`);
    expect(migrationRows.map((row) => row.name)).toEqual(migrationsThrough(SeedMissionsForSale1788460200000).map((migration) => migration.name));

    await revertThrough(dataSource, SeedCosmeticItemsForSale1788460140000); // also takes the Missões for sale seed above it
    const testItemRevertRows = await rows(
      database!.admin,
      `SELECT id FROM ${database!.identifier}.cosmetic_items WHERE for_sale = 1`,
    );
    expect(testItemRevertRows).toHaveLength(0);
    await revertThrough(dataSource, KeepBadgesOffSale1788460080000);
    await badgeInsert('badge-for-sale-after-revert', 1); // the previous CHECK did not know Badges
    await database!.admin.query(`DELETE FROM ${database!.identifier}.cosmetic_items WHERE id = 'badge-for-sale-after-revert'`);
    await dataSource.runMigrations(); // reapply
    await expect(badgeInsert('badge-for-sale-again', 1)).rejects.toThrow(/CHK_cosmetic_items_for_sale/);
    await revertThrough(dataSource, AddMissionRewardItems1788459960000);
    expect(await rows(database!.admin, `SHOW COLUMNS FROM ${database!.identifier}.missions LIKE 'reward_cosmetic_item_id'`)).toHaveLength(1);
    await revertThrough(dataSource, AddCosmeticItemSale1788459840000);
    const saleRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cosmetic_items' ORDER BY ORDINAL_POSITION`,
      [database!.name],
    );
    expect(saleRevertRows.map((row) => row.COLUMN_NAME)).toEqual(['id', 'category', 'name', 'unlock_condition', 'requires_premium']);

    await revertThrough(dataSource, AddCoinEconomy1788459660000); // also takes the mission store and the welcome coins above it
    const coinRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('coin_balances', 'coin_ledger_entries')`,
      [database!.name],
    );
    expect(coinRevertRows).toHaveLength(0);

    await revertThrough(dataSource, AddGuildChatMessageSequence1788459540000); // also takes the study session capped reason above it
    const chatSeqRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guild_chat_messages' ORDER BY ORDINAL_POSITION`,
      [database!.name],
    );
    expect(chatSeqRevertRows.map((row) => row.COLUMN_NAME)).toEqual(['id', 'guild_id', 'user_id', 'body', 'sent_at']);

    await revertThrough(dataSource, AddRaidGoalReachedAt1788459480000);
    const goalRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'raids' AND COLUMN_NAME = 'goal_reached_at'`,
      [database!.name],
    );
    expect(goalRevertRows).toHaveLength(0);
    const contributionIndexRevertRows = await rows(
      database!.admin,
      `SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'raid_contributions' AND COLUMN_NAME = 'study_session_id'`,
      [database!.name],
    );
    expect(contributionIndexRevertRows.map((row) => [row.INDEX_NAME, Number(row.NON_UNIQUE)]))
      .toEqual([['IDX_raid_contributions_study_session_id', 1]]);

    await revertThrough(dataSource, AddRaidParticipations1788459420000);
    const participationRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'raid_participations'`,
      [database!.name],
    );
    expect(participationRevertRows).toHaveLength(0);

    await revertThrough(dataSource, AddRaidMissions1788459360000);
    const missionRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'raids' ORDER BY ORDINAL_POSITION`,
      [database!.name],
    );
    expect(missionRevertRows.map((row) => row.COLUMN_NAME)).toEqual(
      ['id', 'guild_id', 'title', 'goal_xp', 'progress_xp', 'starts_at', 'ends_at', 'status'],
    );

    await revertThrough(dataSource, DropCharacterTitle1788459300000);
    const titleRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'characters' AND COLUMN_NAME = 'title'`,
      [database!.name],
    );
    expect(titleRevertRows).toHaveLength(1);

    await revertThrough(dataSource, SeedInitialCosmeticItems1788459240000);
    const seedRevertRows = await rows(
      database!.admin,
      `SELECT COUNT(*) AS total FROM ${database!.identifier}.cosmetic_items`,
    );
    expect(Number(seedRevertRows[0]?.total)).toBe(0);

    await revertThrough(dataSource, EnforceSingleGuildPerUser1788459180000);
    const singleGuildRevertRows = await rows(
      database!.admin,
      `SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guild_memberships' AND COLUMN_NAME = 'user_id'`,
      [database!.name],
    );
    expect(singleGuildRevertRows.map((row) => [row.INDEX_NAME, Number(row.NON_UNIQUE)])).toEqual(
      expect.arrayContaining([['IDX_guild_memberships_user_id', 1]]),
    );

    await revertThrough(dataSource, AddStudySessionStartReceiptSubject1788459120000);
    const receiptSubjectRevertRows = await rows(
      database!.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'study_session_start_receipts' ORDER BY ORDINAL_POSITION`,
      [database!.name],
    );
    expect(receiptSubjectRevertRows.map((row) => row.COLUMN_NAME)).toEqual(
      ['user_id', 'idempotency_key', 'planned_duration_seconds', 'initiating_session_id', 'response_json'],
    );

    await revertThrough(dataSource, AddStudySessionEndedAtPrecision1788459060000);
    const endedAtRevertRows = await rows(
      database!.admin,
      `SELECT DATETIME_PRECISION FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'study_sessions' AND COLUMN_NAME = 'ended_at'`,
      [database!.name],
    );
    expect(endedAtRevertRows[0]?.DATETIME_PRECISION).toBe(0);

    await revertThrough(dataSource, UnifyStudySessionIdempotencyKeys1788459000000);
    const remainingRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(remainingRows.map((row) => row.TABLE_NAME)).toEqual(
      tablesBeforeCoinEconomy.filter((tableName) => tableName !== 'study_session_command_keys' && tableName !== 'raid_participations').sort(),
    );

    await revertThrough(dataSource, AddStudySessionPauseResume1788458880000);
    const afterPauseResumeRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(afterPauseResumeRevertRows.map((row) => row.TABLE_NAME)).toEqual(
      tablesBeforeCoinEconomy
        .filter((tableName) => tableName !== 'raid_participations')
        .filter((tableName) => !['study_session_transition_receipts', 'study_session_command_keys'].includes(tableName))
        .sort(),
    );

    await revertThrough(dataSource, AddCanonicalStudySessionStart1788458760000);
    const afterCanonicalRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(afterCanonicalRevertRows.map((row) => row.TABLE_NAME)).toEqual(
      tablesBeforeCoinEconomy
        .filter((tableName) => tableName !== 'raid_participations')
        .filter((tableName) => ![
          'active_study_sessions',
          'study_session_start_receipts',
          'study_session_transition_receipts',
          'study_session_command_keys',
        ].includes(tableName))
        .sort(),
    );

    await revertThrough(dataSource, AddSessionRefreshTokenHistory1788458460000); // also takes the recent index above it
    const afterHistoryRevertRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME`,
      [database!.name],
    );
    expect(afterHistoryRevertRows.map((row) => row.TABLE_NAME)).toEqual(
      tablesBeforeCoinEconomy
        .filter((tableName) => tableName !== 'raid_participations')
        .filter((tableName) => !['session_refresh_token_history', 'active_study_sessions', 'study_session_start_receipts', 'study_session_transition_receipts', 'study_session_command_keys'].includes(tableName))
        .sort(),
    );

    await revertThrough(dataSource, CreateWiseSchema1788458400000);
    const emptyRows = await rows(
      database!.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations'`,
      [database!.name],
    );
    expect(emptyRows).toEqual([]);
  });

  it('backfills colliding legacy keys and captures receipt writes from older app instances', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(migrationsBefore(UnifyStudySessionIdempotencyKeys1788459000000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    await database.admin.query(
      `INSERT INTO ${database.identifier}.users
       (id, email, password_hash, display_name, plan_tier)
       VALUES (?, ?, ?, ?, ?)`,
      ['legacy-user', 'legacy@example.com', 'hash', 'Legacy', 'free'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_sessions
       (id, user_id, subject, mode, raid_id, started_at, ended_at, last_heartbeat_at,
        duration_valid_seconds, xp_awarded, discarded_reason, planned_duration_seconds,
        state, run_deadline_at, paused_at, paused_total_seconds, paused_total_milliseconds,
        version, terminal_reason, initiating_session_id)
       VALUES (?, ?, NULL, 'solo', NULL, ?, NULL, ?, 300, 0, NULL, 1500,
        'paused', ?, ?, 0, 0, 2, NULL, ?)`,
      ['legacy-study', 'legacy-user', new Date('2026-09-23T10:00:00Z'), new Date('2026-09-23T10:05:00Z'),
        new Date('2026-09-23T10:25:00Z'), new Date('2026-09-23T10:05:00Z'), 'legacy-auth-session'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.active_study_sessions (user_id, study_session_id)
       VALUES (?, ?)`,
      ['legacy-user', 'legacy-study'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_start_receipts
       (user_id, idempotency_key, planned_duration_seconds, initiating_session_id, response_json)
       VALUES (?, ?, ?, ?, CAST(? AS JSON))`,
      ['legacy-user', 'legacy-shared-key', 1500, 'legacy-auth-session', JSON.stringify({ id: 'legacy-study' })],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_transition_receipts
       (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
      ['legacy-user', 'legacy-study', 'legacy-shared-key', 'pause', 1, JSON.stringify({ id: 'legacy-study', state: 'paused' })],
    );

    await dataSource.destroy();
    dataSource = new DataSource(database.options(migrationsThrough(UnifyStudySessionIdempotencyKeys1788459000000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const backfilledKey = await rows(
      database.admin,
      `SELECT command_kind FROM ${database.identifier}.study_session_command_keys
       WHERE user_id = ? AND idempotency_key = ?`,
      ['legacy-user', 'legacy-shared-key'],
    );
    expect(backfilledKey).toEqual([{ command_kind: 'start' }]);

    // Older app instances only insert into receipt tables; the migration triggers keep these writes scoped.
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_start_receipts
       (user_id, idempotency_key, planned_duration_seconds, initiating_session_id, response_json)
       VALUES (?, ?, ?, ?, CAST(? AS JSON))`,
      ['legacy-user', 'rolling-start-key', 1500, 'legacy-auth-session', JSON.stringify({ id: 'legacy-study' })],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_transition_receipts
       (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
      ['legacy-user', 'legacy-study', 'rolling-transition-key', 'resume', 2, JSON.stringify({ id: 'legacy-study', state: 'running' })],
    );
    const capturedKeys = await rows(
      database.admin,
      `SELECT idempotency_key, command_kind FROM ${database.identifier}.study_session_command_keys
       WHERE user_id = ? ORDER BY idempotency_key`,
      ['legacy-user'],
    );
    expect(capturedKeys).toEqual([
      { idempotency_key: 'legacy-shared-key', command_kind: 'start' },
      { idempotency_key: 'rolling-start-key', command_kind: 'start' },
      { idempotency_key: 'rolling-transition-key', command_kind: 'resume' },
    ]);

    await revertThrough(dataSource, UnifyStudySessionIdempotencyKeys1788459000000);
    const leftoverTriggers = await rows(
      database.admin,
      `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = ?
         AND TRIGGER_NAME IN (?, ?)`,
      [database.name, 'TR_study_session_start_receipt_command_key', 'TR_study_session_transition_receipt_command_key'],
    );
    expect(leftoverTriggers).toHaveLength(0);
  });

  it('keeps existing session history readable and reverses M5 data without loss', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(
      database.options(migrationsBefore(AddSessionRefreshTokenHistory1788458460000)),
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
    await database.admin.query(
      `INSERT INTO ${database.identifier}.guilds (id, name, created_by) VALUES (?, ?, ?)`,
      ['existing-guild', 'Historical Guild', 'existing-user'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.raids
       (id, guild_id, title, goal_xp, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['existing-raid', 'existing-guild', 'Historical Raid', 1000, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z')],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_sessions
       (id, user_id, subject, mode, raid_id, started_at, ended_at, duration_valid_seconds, xp_awarded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['existing-study', 'existing-user', 'Cálculo', 'guild', 'existing-raid', new Date('2026-01-01T12:00:00Z'), new Date('2026-01-01T12:25:00Z'), 1500, 250],
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(AddStudySessionStartReceiptSubject1788459120000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const sessionRows = await rows(
      database.admin,
      `SELECT id, refresh_token_hash FROM ${database.identifier}.sessions`,
    );
    expect(sessionRows).toEqual([
      expect.objectContaining({ id: 'existing-session', refresh_token_hash: 'hash-only' }),
    ]);
    const historicStudies = await rows(
      database.admin,
      `SELECT id, subject, mode, raid_id, duration_valid_seconds, xp_awarded, state FROM ${database.identifier}.study_sessions`,
    );
    expect(historicStudies).toEqual([
      expect.objectContaining({
        id: 'existing-study', subject: 'Cálculo', mode: 'guild', raid_id: 'existing-raid',
        duration_valid_seconds: 1500, xp_awarded: 250, state: 'completed',
      }),
    ]);

    const historyTableRows = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'session_refresh_token_history'`,
      [database.name],
    );
    expect(historyTableRows).toHaveLength(1);

    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_sessions
       (id, user_id, subject, mode, raid_id, started_at, ended_at, last_heartbeat_at,
        duration_valid_seconds, xp_awarded, discarded_reason, planned_duration_seconds,
        state, run_deadline_at, paused_at, paused_total_seconds, version, terminal_reason,
        initiating_session_id)
       VALUES
        (?, ?, NULL, 'solo', NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?),
        (?, ?, NULL, 'solo', NULL, ?, NULL, ?, 0, 0, NULL, ?, 'running', ?, NULL, 0, 1, NULL, ?)`,
      [
        'solo-completed', 'existing-user', new Date('2026-09-22T12:00:00Z'), new Date('2026-09-22T12:25:00Z'),
        new Date('2026-09-22T12:25:00Z'), 1500, 250, 1500, 'completed', new Date('2026-09-22T12:25:00Z'),
        0, 2, 'completed', 'existing-session',
        'solo-running', 'existing-user', new Date('2026-09-22T12:30:00Z'), new Date('2026-09-22T12:30:00Z'),
        1500, new Date('2026-09-22T12:55:00Z'), 'existing-session',
      ],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.active_study_sessions (user_id, study_session_id)
       VALUES (?, ?)`,
      ['existing-user', 'solo-running'],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_start_receipts
       (user_id, idempotency_key, planned_duration_seconds, initiating_session_id, response_json)
       VALUES (?, ?, ?, ?, CAST(? AS JSON))`,
      ['existing-user', 'solo-start-key', 1500, 'existing-session', JSON.stringify({ id: 'solo-running' })],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.study_session_transition_receipts
       (user_id, study_session_id, idempotency_key, action, expected_version, response_json)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
      ['existing-user', 'solo-running', 'solo-transition-key', 'pause', 1, JSON.stringify({ id: 'solo-running', state: 'paused' })],
    );
    await database.admin.query(
      `UPDATE ${database.identifier}.study_session_start_receipts SET subject = ? WHERE idempotency_key = ?`,
      ['Cálculo II', 'solo-start-key'],
    );
    const receiptsWithSubject = await rows(
      database.admin,
      `SELECT idempotency_key, subject FROM ${database.identifier}.study_session_start_receipts`,
    );
    expect(receiptsWithSubject).toEqual([{ idempotency_key: 'solo-start-key', subject: 'Cálculo II' }]);

    // M6 revert: only the receipt column goes away; every persisted Matéria (including legacy Guild rows) stays.
    await revertThrough(dataSource, AddStudySessionStartReceiptSubject1788459120000);
    const receiptColumnsAfterRevert = await rows(
      database.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'study_session_start_receipts'`,
      [database.name],
    );
    expect(receiptColumnsAfterRevert.map((row) => row.COLUMN_NAME)).not.toContain('subject');
    const receiptsAfterRevert = await rows(
      database.admin,
      `SELECT idempotency_key FROM ${database.identifier}.study_session_start_receipts`,
    );
    expect(receiptsAfterRevert).toEqual([{ idempotency_key: 'solo-start-key' }]);
    const studiesAfterRevert = await rows(
      database.admin,
      `SELECT id, subject, mode, raid_id FROM ${database.identifier}.study_sessions ORDER BY id`,
    );
    expect(studiesAfterRevert).toEqual([
      expect.objectContaining({ id: 'existing-study', subject: 'Cálculo', mode: 'guild', raid_id: 'existing-raid' }),
      expect.objectContaining({ id: 'solo-completed', subject: null, mode: 'solo' }),
      expect.objectContaining({ id: 'solo-running', subject: null, mode: 'solo' }),
    ]);
    await dataSource.runMigrations();
    const receiptsAfterReapply = await rows(
      database.admin,
      `SELECT idempotency_key, subject FROM ${database.identifier}.study_session_start_receipts`,
    );
    expect(receiptsAfterReapply).toEqual([{ idempotency_key: 'solo-start-key', subject: null }]);

    await revertThrough(dataSource, AddCanonicalStudySessionStart1788458760000);
    const downgradedHistory = await rows(
      database.admin,
      `SELECT id, subject, mode, raid_id FROM ${database.identifier}.study_sessions ORDER BY id`,
    );
    expect(downgradedHistory).toEqual([
      expect.objectContaining({ id: 'existing-study', subject: 'Cálculo', mode: 'guild', raid_id: 'existing-raid' }),
    ]);
    const archivedSessions = await rows(
      database.admin,
      `SELECT id, subject, mode, state FROM ${database.identifier}.study_session_m5_downgrade_archive ORDER BY id`,
    );
    expect(archivedSessions).toEqual([
      { id: 'solo-completed', subject: null, mode: 'solo', state: 'completed' },
      { id: 'solo-running', subject: null, mode: 'solo', state: 'running' },
    ]);
    const archivedReceipts = await rows(
      database.admin,
      `SELECT user_id, idempotency_key, planned_duration_seconds, initiating_session_id
       FROM ${database.identifier}.study_session_start_receipts_downgrade_archive`,
    );
    expect(archivedReceipts).toEqual([
      expect.objectContaining({
        user_id: 'existing-user', idempotency_key: 'solo-start-key', planned_duration_seconds: 1500,
        initiating_session_id: 'existing-session',
      }),
    ]);
    const archivedTransitionReceipts = await rows(
      database.admin,
      `SELECT user_id, study_session_id, idempotency_key, action, expected_version, response_json
       FROM ${database.identifier}.study_session_transition_receipts_downgrade_archive`,
    );
    expect(archivedTransitionReceipts).toEqual([
      expect.objectContaining({
        user_id: 'existing-user', study_session_id: 'solo-running', idempotency_key: 'solo-transition-key',
        action: 'pause', expected_version: 1,
        response_json: { id: 'solo-running', state: 'paused' },
      }),
    ]);

    await dataSource.runMigrations();
    const restoredSessions = await rows(
      database.admin,
      `SELECT id, subject, mode, raid_id, state FROM ${database.identifier}.study_sessions ORDER BY id`,
    );
    expect(restoredSessions).toEqual([
      expect.objectContaining({ id: 'existing-study', subject: 'Cálculo', mode: 'guild', raid_id: 'existing-raid', state: 'completed' }),
      { id: 'solo-completed', subject: null, mode: 'solo', raid_id: null, state: 'completed' },
      { id: 'solo-running', subject: null, mode: 'solo', raid_id: null, state: 'running' },
    ]);
    const restoredActiveSession = await rows(
      database.admin,
      `SELECT user_id, study_session_id FROM ${database.identifier}.active_study_sessions`,
    );
    expect(restoredActiveSession).toEqual([{ user_id: 'existing-user', study_session_id: 'solo-running' }]);
    const restoredReceipt = await rows(
      database.admin,
      `SELECT user_id, idempotency_key, response_json
       FROM ${database.identifier}.study_session_start_receipts`,
    );
    expect(restoredReceipt).toEqual([
      expect.objectContaining({ user_id: 'existing-user', idempotency_key: 'solo-start-key', response_json: { id: 'solo-running' } }),
    ]);
    const restoredTransitionReceipt = await rows(
      database.admin,
      `SELECT user_id, study_session_id, idempotency_key, action, expected_version, response_json
       FROM ${database.identifier}.study_session_transition_receipts`,
    );
    expect(restoredTransitionReceipt).toEqual([
      expect.objectContaining({
        user_id: 'existing-user', study_session_id: 'solo-running', idempotency_key: 'solo-transition-key',
        action: 'pause', expected_version: 1,
        response_json: { id: 'solo-running', state: 'paused' },
      }),
    ]);
    const restoredCommandKeys = await rows(
      database.admin,
      `SELECT user_id, idempotency_key, command_kind FROM ${database.identifier}.study_session_command_keys ORDER BY idempotency_key`,
    );
    expect(restoredCommandKeys).toEqual([
      { user_id: 'existing-user', idempotency_key: 'solo-start-key', command_kind: 'start' },
      { user_id: 'existing-user', idempotency_key: 'solo-transition-key', command_kind: 'pause' },
    ]);
    const leftoverArchives = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?)`,
      [database.name, 'study_session_m5_downgrade_archive', 'study_session_start_receipts_downgrade_archive', 'study_session_transition_receipts_downgrade_archive'],
    );
    expect(leftoverArchives).toHaveLength(0);

    // Every migration, down to the archives.
    await revertThrough(dataSource, CreateWiseSchema1788458400000);
    const remainingSchemaTables = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'migrations'`,
      [database.name],
    );
    expect(remainingSchemaTables.map((row) => row.TABLE_NAME).sort()).toEqual([
      'study_session_m5_downgrade_archive',
      'study_session_start_receipts_downgrade_archive',
      'study_session_transition_receipts_downgrade_archive',
    ]);
  });

  it('seeds the Catalog, backfills existing Characters without re-equipping, and reverts the seed', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(SeedInitialCosmeticItems1788459240000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    const insertUser = async (id: string, level: number) => {
      await database!.admin.query(
        `INSERT INTO ${database!.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
      await database!.admin.query(
        `INSERT INTO ${database!.identifier}.characters (id, user_id, level, xp_total) VALUES (?, ?, ?, 0)`,
        [`${id}-character`, id, level],
      );
    };
    await insertUser('veteran', 13);
    await insertUser('newcomer', 1);
    await insertUser('collector', 4);
    // A title equipped before the seed must stay the only equipped title.
    await database.admin.query(
      `INSERT INTO ${database.identifier}.cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ('legacy-title', 'title', 'Veterano', 'raid:legacy', 0)`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       VALUES ('legacy-row', 'veteran', 'legacy-title', 1)`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(SeedInitialCosmeticItems1788459240000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const catalog = await rows(
      database.admin,
      `SELECT category, name, unlock_condition, requires_premium FROM ${database.identifier}.cosmetic_items
       WHERE id <> 'legacy-title' ORDER BY id`,
    );
    expect(catalog.map((row) => [row.category, row.name, row.unlock_condition, Number(row.requires_premium)])).toEqual([
      ['avatar', 'Capuz do Erudito', 'level:1', 0],
      ['title', 'Aprendiz', 'level:1', 0],
      ['badge', 'Madrugador', 'level:3', 0],
      ['title', 'Estudante Crepuscular', 'level:5', 0],
      ['avatar', 'Manto da Vigília', 'level:8', 0],
      ['badge', 'Cem Sessões', 'level:12', 0],
      ['accessory', 'Selo dos Madrugadores', 'raid:*', 0],
      ['title', 'Mestre da Aurora', 'level:15', 1],
    ]);

    const inventory = await rows(
      database.admin,
      `SELECT uci.user_id, ci.name, uci.equipped FROM ${database.identifier}.user_cosmetic_items uci
       JOIN ${database.identifier}.cosmetic_items ci ON ci.id = uci.cosmetic_item_id
       ORDER BY uci.user_id, ci.id`,
    );
    const owned = (userId: string) => inventory
      .filter((row) => row.user_id === userId)
      .map((row) => [row.name, Number(row.equipped)]);
    expect(owned('veteran')).toEqual([
      ['Capuz do Erudito', 1],
      ['Aprendiz', 0],
      ['Madrugador', 0],
      ['Estudante Crepuscular', 0],
      ['Manto da Vigília', 0],
      ['Cem Sessões', 0],
      ['Veterano', 1],
    ]);
    expect(owned('newcomer')).toEqual([['Capuz do Erudito', 1], ['Aprendiz', 1]]);
    expect(owned('collector')).toEqual([['Capuz do Erudito', 1], ['Aprendiz', 1], ['Madrugador', 0]]);

    await revertThrough(dataSource, SeedInitialCosmeticItems1788459240000);
    const afterRevert = await rows(
      database.admin,
      `SELECT uci.user_id, uci.cosmetic_item_id, uci.equipped FROM ${database.identifier}.user_cosmetic_items uci`,
    );
    expect(afterRevert.map((row) => [row.user_id, row.cosmetic_item_id, Number(row.equipped)])).toEqual([
      ['veteran', 'legacy-title', 1],
    ]);
    const catalogAfterRevert = await rows(
      database.admin,
      `SELECT id FROM ${database.identifier}.cosmetic_items`,
    );
    expect(catalogAfterRevert).toEqual([{ id: 'legacy-title' }]);
  });

  it('drops the textual Character title and restores it from the equipped Título on downgrade', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(DropCharacterTitle1788459300000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    for (const [id, title] of [['titled', 'Legado'], ['untitled', null]] as const) {
      await database.admin.query(
        `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
      await database.admin.query(
        `INSERT INTO ${database.identifier}.characters (id, user_id, level, xp_total, title) VALUES (?, ?, 1, 0, ?)`,
        [`${id}-character`, id, title],
      );
    }
    await database.admin.query(
      `INSERT INTO ${database.identifier}.user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       VALUES ('titled-row', 'titled', 'c05e71c0-0000-4000-8000-000000000002', 1)`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(DropCharacterTitle1788459300000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const columns = await rows(
      database.admin,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'characters'`,
      [database.name],
    );
    expect(columns.map((row) => row.COLUMN_NAME)).not.toContain('title');

    await revertThrough(dataSource, DropCharacterTitle1788459300000);
    const restored = await rows(
      database.admin,
      `SELECT user_id, title FROM ${database.identifier}.characters ORDER BY user_id`,
    );
    expect(restored.map((row) => [row.user_id, row.title])).toEqual([
      ['titled', 'Aprendiz'],
      ['untitled', null],
    ]);
  });

  it('seeds the Missões, links reward items, gives Raids a Missão and the current week to existing Guilds, and reverts', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(AddRaidMissions1788459360000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    for (const id of ['founder', 'second']) {
      await database.admin.query(
        `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
    }
    await database.admin.query(
      `INSERT INTO ${database.identifier}.guilds (id, name, created_by) VALUES ('old-guild', 'Velha Guarda', 'founder')`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.guild_memberships (id, guild_id, user_id, role)
       VALUES ('m1', 'old-guild', 'founder', 'leader'), ('m2', 'old-guild', 'second', 'member')`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.raids (id, guild_id, title, goal_xp, starts_at, ends_at, status)
       VALUES ('historical', 'old-guild', 'Antiga', 1000, '2026-01-05 03:00:00', '2026-01-12 02:59:59', 'expired')`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(AddGuildMissionChoice1788460020000)));
    await dataSource.initialize();
    const before = saoPauloWeekAt(new Date());
    await dataSource.runMigrations();

    const missions = await rows(
      database.admin,
      `SELECT m.slug, m.name, m.image_url, ci.name AS reward, ci.unlock_condition
       FROM ${database.identifier}.missions m
       JOIN ${database.identifier}.mission_reward_items mri ON mri.mission_id = m.id
       JOIN ${database.identifier}.cosmetic_items ci ON ci.id = mri.cosmetic_item_id
       WHERE m.rotation_order IS NOT NULL ORDER BY m.rotation_order`,
    );
    expect(missions.map((row) => [row.slug, row.name, row.image_url, row.reward, row.unlock_condition])).toEqual([
      ['vigilia-da-aurora', 'Vigília da Aurora', null, 'Selo dos Madrugadores', 'raid:vigilia-da-aurora'],
      ['cerco-ao-grimorio', 'Cerco ao Grimório', null, 'Marcador do Grimório', 'raid:cerco-ao-grimorio'],
      ['marcha-do-silencio', 'Marcha do Silêncio', null, 'Lanterna do Silêncio', 'raid:marcha-do-silencio'],
      ['forja-dos-sabios', 'Forja dos Sábios', null, 'Brasão da Forja', 'raid:forja-dos-sabios'],
    ]);

    const raids = await rows(
      database.admin,
      `SELECT r.id, r.goal_xp, r.status, CAST(r.starts_at AS CHAR) AS starts_at, CAST(r.ends_at AS CHAR) AS ends_at, m.slug
       FROM ${database.identifier}.raids r JOIN ${database.identifier}.missions m ON m.id = r.mission_id
       WHERE r.guild_id = 'old-guild' ORDER BY r.starts_at`,
    );
    expect(raids).toHaveLength(2);
    expect(raids[0]).toMatchObject({ id: 'historical', status: 'expired', slug: expect.any(String) });
    const current = raids[1]!;
    expect(current.status).toBe('active');
    // Stored in UTC; the admin connection is told nothing about time zones, so compare the raw text.
    const utcText = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
    expect(current.starts_at).toBe(utcText(before.startsAt));
    expect(current.ends_at).toBe(utcText(before.endsAt));
    expect(current.slug).toBe(missions[before.number % 4]!.slug);
    expect(Number(current.goal_xp) % 50).toBe(0);
    expect(Number(current.goal_xp)).toBeGreaterThan(0);
    expect(Number(current.goal_xp)).toBeLessThanOrEqual(3000);

    await revertThrough(dataSource, AddRaidMissions1788459360000);
    const reverted = await rows(
      database.admin,
      `SELECT title FROM ${database.identifier}.raids WHERE id = 'historical'`,
    );
    expect(reverted).toEqual([{ title: expect.any(String) }]);
    expect(reverted[0]!.title).not.toBe('');
    const tables = await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions'`,
      [database.name],
    );
    expect(tables).toEqual([]);
    const seal = await rows(
      database.admin,
      `SELECT unlock_condition FROM ${database.identifier}.cosmetic_items WHERE name = 'Selo dos Madrugadores'`,
    );
    expect(seal).toEqual([{ unlock_condition: 'raid:*' }]);
    const newItems = await rows(
      database.admin,
      `SELECT name FROM ${database.identifier}.cosmetic_items WHERE name IN ('Marcador do Grimório', 'Lanterna do Silêncio', 'Brasão da Forja')`,
    );
    expect(newItems).toEqual([]);
  });

  it('turns earlier Contributors into Participantes and drops the table on downgrade', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(AddRaidParticipations1788459420000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    for (const id of ['founder', 'second']) {
      await database.admin.query(
        `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
    }
    await database.admin.query(
      `INSERT INTO ${database.identifier}.guilds (id, name, created_by) VALUES ('g', 'Guilda', 'founder')`,
    );
    const [[raid]] = await database.admin.query(
      `SELECT id FROM ${database.identifier}.raids WHERE guild_id = 'g'`,
    ) as unknown as [Array<{ id: string }>];
    let raidId = raid?.id;
    if (!raidId) {
      raidId = 'raid-1';
      await database.admin.query(
        `INSERT INTO ${database.identifier}.raids (id, guild_id, mission_id, goal_xp, starts_at, ends_at, status)
         SELECT 'raid-1', 'g', id, 1000, '2026-01-05 03:00:00', '2026-01-12 02:59:59', 'expired'
         FROM ${database.identifier}.missions LIMIT 1`,
      );
    }
    await database.admin.query(
      `INSERT INTO ${database.identifier}.raid_contributions (id, raid_id, user_id, xp_contributed)
       VALUES ('c1', ?, 'second', 100), ('c2', ?, 'second', 50)`,
      [raidId, raidId],
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(AddRaidParticipations1788459420000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const participations = await rows(
      database.admin,
      `SELECT raid_id, user_id FROM ${database.identifier}.raid_participations`,
    );
    expect(participations).toEqual([{ raid_id: raidId, user_id: 'second' }]);
    await expect(database.admin.query(
      `INSERT INTO ${database.identifier}.raid_participations (id, raid_id, user_id) VALUES ('dup', ?, 'second')`,
      [raidId],
    )).rejects.toThrow(/Duplicate entry/);

    await revertThrough(dataSource, AddRaidParticipations1788459420000);
    expect(await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'raid_participations'`,
      [database.name],
    )).toEqual([]);
  });

  it('dates the Meta batida, reopens the Raids of the current week and keeps one Contribution per Study Session', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(AddRaidGoalReachedAt1788459480000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    const db = database.identifier;
    await database.admin.query(
      `INSERT INTO ${db}.users (id, email, password_hash, display_name, plan_tier) VALUES ('u', 'u@example.com', 'hash', 'U', 'free')`,
    );
    await database.admin.query(`INSERT INTO ${db}.guilds (id, name, created_by) VALUES ('g', 'Guilda', 'u')`);
    await database.admin.query(`DELETE FROM ${db}.raids WHERE guild_id = 'g'`);
    // A Raid of this week that reached the goal under the old rule, and one closed in the past.
    await database.admin.query(
      `INSERT INTO ${db}.raids (id, guild_id, mission_id, goal_xp, progress_xp, starts_at, ends_at, status)
       SELECT 'current', 'g', id, 100, 150, UTC_TIMESTAMP() - INTERVAL 1 DAY, UTC_TIMESTAMP() + INTERVAL 1 DAY, 'completed'
       FROM ${db}.missions ORDER BY rotation_order LIMIT 1`,
    );
    await database.admin.query(
      `INSERT INTO ${db}.raids (id, guild_id, mission_id, goal_xp, progress_xp, starts_at, ends_at, status)
       SELECT 'past', 'g', id, 100, 40, '2026-01-05 03:00:00', '2026-01-12 02:59:59', 'expired'
       FROM ${db}.missions ORDER BY rotation_order LIMIT 1`,
    );
    await database.admin.query(
      `INSERT INTO ${db}.study_sessions (id, user_id, subject, mode, raid_id, started_at) VALUES ('s1', 'u', NULL, 'guild', 'current', NOW())`,
    );
    // The same Study Session counted twice (50 XP each): the copy leaves and its XP comes off the progress.
    await database.admin.query(
      `INSERT INTO ${db}.raid_contributions (id, raid_id, user_id, study_session_id, xp_contributed, created_at) VALUES
       ('c1', 'current', 'u', 's1', 50, '2026-10-06 10:00:00.000000'),
       ('c2', 'current', 'u', 's1', 50, '2026-10-06 10:00:01.000000'),
       ('c3', 'current', 'u', NULL, 50, '2026-10-07 09:00:00.000000')`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(AddRaidGoalReachedAt1788459480000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const raids = await rows(
      database.admin,
      `SELECT id, status, progress_xp, DATE_FORMAT(goal_reached_at, '%Y-%m-%d %H:%i:%s') AS goal_reached_at
       FROM ${db}.raids WHERE guild_id = 'g' ORDER BY id`,
    );
    expect(raids).toEqual([
      { id: 'current', status: 'active', progress_xp: 100, goal_reached_at: '2026-10-07 09:00:00' },
      { id: 'past', status: 'expired', progress_xp: 40, goal_reached_at: null },
    ]);
    expect(await rows(database.admin, `SELECT id FROM ${db}.raid_contributions ORDER BY id`))
      .toEqual([{ id: 'c1' }, { id: 'c3' }]);
    await expect(database.admin.query(
      `INSERT INTO ${db}.raid_contributions (id, raid_id, user_id, study_session_id, xp_contributed) VALUES ('c4', 'current', 'u', 's1', 10)`,
    )).rejects.toThrow(/Duplicate entry/);

    await revertThrough(dataSource, AddRaidGoalReachedAt1788459480000);
    expect(await rows(database.admin, `SELECT id, status FROM ${db}.raids WHERE guild_id = 'g' ORDER BY id`))
      .toEqual([{ id: 'current', status: 'completed' }, { id: 'past', status: 'expired' }]);
    await database.admin.query(
      `INSERT INTO ${db}.raid_contributions (id, raid_id, user_id, study_session_id, xp_contributed) VALUES ('c4', 'current', 'u', 's1', 10)`,
    );
  });

  it('keeps the rotation Missões free, lets priced Missões leave the rotation and drops them on downgrade', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(migrationsThrough(AddMissionStore1788459780000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const db = database.identifier;

    expect(await rows(database.admin, `SELECT COUNT(*) AS n FROM ${db}.missions WHERE price IS NULL AND rotation_order IS NOT NULL`))
      .toEqual([{ n: 4 }]);

    await database.admin.query(
      `INSERT INTO ${db}.users (id, email, password_hash, display_name, plan_tier) VALUES ('u', 'u@example.com', 'hash', 'U', 'free')`,
    );
    const insertPriced = (id: string) => database!.admin.query(
      `INSERT INTO ${db}.missions (id, slug, name, description, reward_cosmetic_item_id, rotation_order, price)
       SELECT ?, ?, 'Cara', 'Missão à venda.', reward_cosmetic_item_id, NULL, 90 FROM ${db}.missions LIMIT 1`,
      [id, `slug-${id}`],
    );
    await insertPriced('p1');
    await insertPriced('p2'); // two Missões with no rotation position: the unique index admits several nulls
    await database.admin.query(`INSERT INTO ${db}.user_missions (id, user_id, mission_id) VALUES ('o1', 'u', 'p1')`);
    await expect(database.admin.query(
      `INSERT INTO ${db}.user_missions (id, user_id, mission_id) VALUES ('o2', 'u', 'p1')`,
    )).rejects.toThrow(/Duplicate entry/);

    await revertThrough(dataSource, AddMissionStore1788459780000);
    expect(await rows(database.admin, `SELECT COUNT(*) AS n FROM ${db}.missions`)).toEqual([{ n: 4 }]);
    expect(await rows(
      database.admin,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_missions'`,
      [database.name],
    )).toHaveLength(0);
  });

  it('seeds the four Missões for sale with off-sale reward items, reverts them and reapplies', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    dataSource = new DataSource(database.options(migrationsThrough(SeedMissionsForSale1788460200000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    const db = database.identifier;

    const forSale = () => rows(
      database!.admin,
      `SELECT slug, price, rotation_order, image_url FROM ${db}.missions WHERE price IS NOT NULL ORDER BY price`,
    );
    const rewards = () => rows(
      database!.admin,
      `SELECT m.slug, ci.category, ci.name, ci.unlock_condition, ci.for_sale, ci.price, ci.requires_premium
       FROM ${db}.mission_reward_items r
       JOIN ${db}.missions m ON m.id = r.mission_id
       JOIN ${db}.cosmetic_items ci ON ci.id = r.cosmetic_item_id
       WHERE m.price IS NOT NULL ORDER BY m.price, ci.id`,
    );

    expect(await forSale()).toEqual([
      { slug: 'contrato-do-grifo', price: 90, rotation_order: null, image_url: null },
      { slug: 'torre-dos-ratos', price: 180, rotation_order: null, image_url: null },
      { slug: 'ilha-das-brumas', price: 300, rotation_order: null, image_url: null },
      { slug: 'cacada-selvagem', price: 480, rotation_order: null, image_url: null },
    ]);
    const seeded = await rewards();
    expect(seeded.map((row) => [row.slug, row.category])).toEqual([
      ['contrato-do-grifo', 'badge'],
      ['torre-dos-ratos', 'badge'],
      ['torre-dos-ratos', 'accessory'],
      ['ilha-das-brumas', 'badge'],
      ['ilha-das-brumas', 'title'],
      ['cacada-selvagem', 'badge'],
      ['cacada-selvagem', 'title'],
      ['cacada-selvagem', 'avatar'],
    ]);
    for (const row of seeded) {
      expect(row).toMatchObject({ unlock_condition: `raid:${row.slug}`, for_sale: 0, price: null, requires_premium: 0 });
    }
    // The rotation keeps its four free Missões.
    expect(await rows(database.admin, `SELECT COUNT(*) AS n FROM ${db}.missions WHERE price IS NULL AND rotation_order IS NOT NULL`))
      .toEqual([{ n: 4 }]);

    await revertThrough(dataSource, SeedMissionsForSale1788460200000);
    expect(await forSale()).toEqual([]);
    expect(await rows(database.admin, `SELECT COUNT(*) AS n FROM ${db}.missions`)).toEqual([{ n: 4 }]);
    expect(await rows(database.admin, `SELECT COUNT(*) AS n FROM ${db}.cosmetic_items WHERE id LIKE 'c05e71c0-0000-4000-8000-0000000002%'`))
      .toEqual([{ n: 0 }]);

    await dataSource.runMigrations();
    expect(await rewards()).toEqual(seeded);
  });

  it('credits 90 welcome coins once to each existing account, skips repeats and reverts cleanly', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(GrantWelcomeCoins1788459720000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    for (const id of ['veteran', 'newcomer', 'signed-up']) {
      await database.admin.query(
        `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
    }
    // The veteran already earned coins before the migration; the new account already got its signup credit.
    await database.admin.query(
      `INSERT INTO ${database.identifier}.coin_balances (user_id, balance, updated_at) VALUES ('veteran', 12, NOW(3)), ('signed-up', 90, NOW(3))`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.coin_ledger_entries (id, user_id, amount, balance_after, origin_type, origin_ref, created_at)
       VALUES ('l1', 'veteran', 12, 12, 'study-session', 'session-1', NOW(3)),
              ('l2', 'signed-up', 90, 90, 'signup', 'signed-up', NOW(3))`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(GrantWelcomeCoins1788459720000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const balances = async () => (await rows(
      database!.admin,
      `SELECT user_id, balance FROM ${database!.identifier}.coin_balances ORDER BY user_id`,
    )).map((row) => [row.user_id, Number(row.balance)]);
    const welcomes = async () => (await rows(
      database!.admin,
      `SELECT user_id, amount, balance_after FROM ${database!.identifier}.coin_ledger_entries
       WHERE origin_type = 'migration' AND origin_ref = 'welcome' ORDER BY user_id`,
    )).map((row) => [row.user_id, Number(row.amount), Number(row.balance_after)]);
    expect(await balances()).toEqual([['newcomer', 90], ['signed-up', 90], ['veteran', 102]]);
    expect(await welcomes()).toEqual([['newcomer', 90, 90], ['veteran', 90, 102]]);

    // Revert and reapply: the credit happens once per account, never twice.
    await revertThrough(dataSource, GrantWelcomeCoins1788459720000);
    expect(await welcomes()).toEqual([]);
    expect(await balances()).toEqual([['newcomer', 0], ['signed-up', 90], ['veteran', 12]]);
    await dataSource.runMigrations();
    expect(await balances()).toEqual([['newcomer', 90], ['signed-up', 90], ['veteran', 102]]);
    expect(await welcomes()).toEqual([['newcomer', 90, 90], ['veteran', 90, 102]]);

    // Running the same credit again changes nothing.
    await new GrantWelcomeCoins1788459720000().up(dataSource.createQueryRunner());
    expect(await balances()).toEqual([['newcomer', 90], ['signed-up', 90], ['veteran', 102]]);
    expect(await welcomes()).toEqual([['newcomer', 90, 90], ['veteran', 90, 102]]);
  });

  it('seeds the Cosmetic Items À venda, clears the old test item, and removes only the seeded ids on revert', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(SeedCosmeticItemsForSale1788460140000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    const testItemId = 'c05e71c0-0000-4000-8000-00000000f001';
    // A local database that already ran the temporary test item migration, with the item bought by someone.
    // KeepBadgesOffSale has since taken that Badge off sale, so it stays in the table with for_sale = 0.
    await database.admin.query(
      `INSERT INTO ${database.identifier}.cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES (?, 'badge', '[TESTE] Item de teste da Loja - remover', 'purchase', 0, 30, 0)`,
      [testItemId],
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
       VALUES ('buyer', 'buyer@example.com', 'hash', 'buyer', 'free')`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       VALUES ('test-row', 'buyer', ?, 0)`,
      [testItemId],
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(SeedCosmeticItemsForSale1788460140000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const forSale = async () => (await rows(
      database!.admin,
      `SELECT id, category, name, unlock_condition, requires_premium, price FROM ${database!.identifier}.cosmetic_items
       WHERE for_sale = 1 ORDER BY id`,
    )).map((row) => [row.id, row.name, Number(row.price), row.category, row.unlock_condition, Number(row.requires_premium)]);
    expect(await forSale()).toEqual(ITEMS_FOR_SALE.map(([id, name, price, category]) => [id, name, price, category, 'purchase', 0]));
    expect(await rows(database.admin, `SELECT id FROM ${database.identifier}.cosmetic_items WHERE id = ?`, [testItemId])).toHaveLength(0);
    expect(await rows(database.admin, `SELECT id FROM ${database.identifier}.user_cosmetic_items WHERE id = 'test-row'`)).toHaveLength(0);

    // Items outside the seeded ids survive the revert; the test item does not come back.
    await revertThrough(dataSource, SeedCosmeticItemsForSale1788460140000);
    expect(await forSale()).toEqual([]);
    expect(await rows(database.admin, `SELECT id FROM ${database.identifier}.cosmetic_items WHERE id = ?`, [testItemId])).toHaveLength(0);
    expect(await rows(database.admin, `SELECT id FROM ${database.identifier}.cosmetic_items WHERE name = 'Capuz do Erudito'`)).toHaveLength(1);

    await dataSource.runMigrations();
    expect(await forSale()).toHaveLength(ITEMS_FOR_SALE.length);
  });

  it('adds the Arma category: the Espada to every existing Character, equipped once, and the Cajado and Besta À venda', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database.options(migrationsBefore(AddWeaponCategory1788460440000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    for (const id of ['veteran', 'newcomer']) {
      await database.admin.query(
        `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
         VALUES (?, ?, 'hash', ?, 'free')`,
        [id, `${id}@example.com`, id],
      );
      await database.admin.query(
        `INSERT INTO ${database.identifier}.characters (id, user_id, level, xp_total) VALUES (?, ?, 1, 0)`,
        [`${id}-character`, id],
      );
    }
    // A Character that already equips another Arma keeps it: the Espada is granted but stays in the Inventário.
    await database.admin.query(
      `INSERT INTO ${database.identifier}.users (id, email, password_hash, display_name, plan_tier)
       VALUES ('armed', 'armed@example.com', 'hash', 'armed', 'free')`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.characters (id, user_id, level, xp_total) VALUES ('armed-character', 'armed', 1, 0)`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ('legacy-weapon', 'weapon', 'Machado', 'raid:legacy', 0)`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       VALUES ('armed-row', 'armed', 'legacy-weapon', 1)`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database.options(migrationsThrough(AddWeaponCategory1788460440000)));
    await dataSource.initialize();
    await dataSource.runMigrations();

    const weapons = async () => (await rows(
      database!.admin,
      `SELECT name, unlock_condition, price, for_sale FROM ${database!.identifier}.cosmetic_items
       WHERE category = 'weapon' ORDER BY name`,
    )).map((row) => [row.name, row.unlock_condition, row.price === null ? null : Number(row.price), Number(row.for_sale)]);
    const inventory = async () => (await rows(
      database!.admin,
      `SELECT uci.user_id, ci.name, uci.equipped FROM ${database!.identifier}.user_cosmetic_items uci
       JOIN ${database!.identifier}.cosmetic_items ci ON ci.id = uci.cosmetic_item_id
       WHERE ci.category = 'weapon' ORDER BY uci.user_id, ci.name`,
    )).map((row) => [row.user_id, row.name, Number(row.equipped)]);
    const expectedWeapons = [['Besta', 'purchase', 150, 1], ['Cajado', 'purchase', 90, 1], ['Espada', 'level:1', null, 0], ['Machado', 'raid:legacy', null, 0]];
    expect(await weapons()).toEqual(expectedWeapons);
    const armed = [['armed', 'Espada', 0], ['armed', 'Machado', 1]];
    expect(await inventory()).toEqual([...armed, ['newcomer', 'Espada', 1], ['veteran', 'Espada', 1]]);

    // Running it again duplicates nothing and keeps a choice made since: the veteran swapped to the Cajado.
    await database.admin.query(
      `UPDATE ${database.identifier}.user_cosmetic_items SET equipped = 0 WHERE user_id = 'veteran'`,
    );
    await database.admin.query(
      `INSERT INTO ${database.identifier}.user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       VALUES ('veteran-cajado', 'veteran', ?, 1)`,
      [STAFF_ID],
    );
    const runner = dataSource.createQueryRunner();
    try {
      await new AddWeaponCategory1788460440000().up(runner);
    } finally {
      await runner.release();
    }
    expect(await weapons()).toEqual(expectedWeapons);
    expect(await inventory()).toEqual([
      ...armed,
      ['newcomer', 'Espada', 1],
      ['veteran', 'Cajado', 1],
      ['veteran', 'Espada', 0],
    ]);

    await revertThrough(dataSource, AddWeaponCategory1788460440000);
    expect(await weapons()).toEqual([['Machado', 'raid:legacy', null, 0]]);
    expect(await inventory()).toEqual([['armed', 'Machado', 1]]);

    await dataSource.runMigrations();
    expect(await weapons()).toEqual(expectedWeapons);
  });

  it('marks existing Study Sessions as Ciclo and reverts the kind column', async () => {
    database = await createIntegrationDatabase('wise_migrations_test');
    initialDataSource = new DataSource(database!.options(migrationsBefore(AddStudySessionKind1788460500000)));
    await initialDataSource.initialize();
    await initialDataSource.runMigrations();
    await database!.admin.query(
      `INSERT INTO ${database!.identifier}.users (id, email, password_hash, display_name, plan_tier)
       VALUES ('kind-user', 'kind@example.com', 'hash', 'Kind', 'free')`,
    );
    await database!.admin.query(
      `INSERT INTO ${database!.identifier}.study_sessions (id, user_id, subject, mode, planned_duration_seconds)
       VALUES ('kind-legacy', 'kind-user', 'Cálculo', 'solo', NULL)`,
    );
    await initialDataSource.destroy();
    initialDataSource = undefined;

    dataSource = new DataSource(database!.options(migrationsThrough(AddStudySessionKind1788460500000)));
    await dataSource.initialize();
    await dataSource.runMigrations();
    expect(await rows(database!.admin, `SELECT kind, planned_duration_seconds FROM ${database!.identifier}.study_sessions`))
      .toEqual([{ kind: 'cycle', planned_duration_seconds: null }]);

    await revertThrough(dataSource, AddStudySessionKind1788460500000);
    const columns = await rows(
      database!.admin,
      'SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND COLUMN_NAME = ?',
      [database!.name, 'study_sessions', 'kind'],
    );
    expect(columns).toEqual([]);
  });
});
