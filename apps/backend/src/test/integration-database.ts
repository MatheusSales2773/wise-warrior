import type { Connection, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { DataSource, type DataSourceOptions, type MigrationInterface } from 'typeorm';
import { createDatabaseOptions } from '../config/database.config';
import { AddSessionRefreshTokenHistory1788458460000 } from '../migrations/1788458460000-add-session-refresh-token-history';
import { CreateWiseSchema1788458400000 } from '../migrations/1788458400000-create-wise-schema';
import { AddStudySessionRecentIndex1788458520000 } from '../migrations/1788458520000-add-study-session-recent-index';
import { AddCanonicalStudySessionStart1788458760000 } from '../migrations/1788458760000-add-canonical-study-session-start';
import { AddStudySessionPauseResume1788458880000 } from '../migrations/1788458880000-add-study-session-pause-resume';
import { UnifyStudySessionIdempotencyKeys1788459000000 } from '../migrations/1788459000000-unify-study-session-idempotency-keys';
import { AddStudySessionEndedAtPrecision1788459060000 } from '../migrations/1788459060000-add-study-session-ended-at-precision';
import { AddStudySessionStartReceiptSubject1788459120000 } from '../migrations/1788459120000-add-study-session-start-receipt-subject';
import { EnforceSingleGuildPerUser1788459180000 } from '../migrations/1788459180000-enforce-single-guild-per-user';
import { DropCharacterTitle1788459300000 } from '../migrations/1788459300000-drop-character-title';
import { SeedInitialCosmeticItems1788459240000 } from '../migrations/1788459240000-seed-initial-cosmetic-items';
import { AddRaidMissions1788459360000 } from '../migrations/1788459360000-add-raid-missions';
import { AddRaidParticipations1788459420000 } from '../migrations/1788459420000-add-raid-participations';
import { AddRaidGoalReachedAt1788459480000 } from '../migrations/1788459480000-add-raid-goal-reached-at';
import { AddGuildChatMessageSequence1788459540000 } from '../migrations/1788459540000-add-guild-chat-message-sequence';
import { AddStudySessionCappedReason1788459600000 } from '../migrations/1788459600000-add-study-session-capped-reason';
import { AddCoinEconomy1788459660000 } from '../migrations/1788459660000-add-coin-economy';
import { GrantWelcomeCoins1788459720000 } from '../migrations/1788459720000-grant-welcome-coins';
import { AddMissionStore1788459780000 } from '../migrations/1788459780000-add-mission-store';
import { AddCosmeticItemSale1788459840000 } from '../migrations/1788459840000-add-cosmetic-item-sale';
import { AddMissionRewardItems1788459960000 } from '../migrations/1788459960000-add-mission-reward-items';
import { AddGuildMissionChoice1788460020000 } from '../migrations/1788460020000-add-guild-mission-choice';
import { KeepBadgesOffSale1788460080000 } from '../migrations/1788460080000-keep-badges-off-sale';
import { SeedCosmeticItemsForSale1788460140000 } from '../migrations/1788460140000-seed-cosmetic-items-for-sale';
import { SeedMissionsForSale1788460200000 } from '../migrations/1788460200000-seed-missions-for-sale';
import { AddGuildChatNotices1788460260000 } from '../migrations/1788460260000-add-guild-chat-notices';
import { AddRaidDragonFury1788460320000 } from '../migrations/1788460320000-add-raid-dragon-fury';
import { AddRaidMissionOwner1788460380000 } from '../migrations/1788460380000-add-raid-mission-owner';
import { AddWeaponCategory1788460440000 } from '../migrations/1788460440000-add-weapon-category';
import { AddStudySessionKind1788460500000 } from '../migrations/1788460500000-add-study-session-kind';
import { AddStudySessionPauseCount1788460680000 } from '../migrations/1788460680000-add-study-session-pause-count';
import { SessionCountBadgeConditions1788460560000 } from '../migrations/1788460560000-session-count-badge-conditions';
import { SeedPremiumCosmeticItems1788460740000 } from '../migrations/1788460740000-seed-premium-cosmetic-items';
import { AddObjectiveCoinOrigin1788460620000 } from '../migrations/1788460620000-add-objective-coin-origin';

export type MigrationClass = new () => MigrationInterface;

export const APPLICATION_MIGRATIONS: MigrationClass[] = [
  CreateWiseSchema1788458400000,
  AddSessionRefreshTokenHistory1788458460000,
  AddStudySessionRecentIndex1788458520000,
  AddCanonicalStudySessionStart1788458760000,
  AddStudySessionPauseResume1788458880000,
  UnifyStudySessionIdempotencyKeys1788459000000,
  AddStudySessionEndedAtPrecision1788459060000,
  AddStudySessionStartReceiptSubject1788459120000,
  EnforceSingleGuildPerUser1788459180000,
  SeedInitialCosmeticItems1788459240000,
  DropCharacterTitle1788459300000,
  AddRaidMissions1788459360000,
  AddRaidParticipations1788459420000,
  AddRaidGoalReachedAt1788459480000,
  AddGuildChatMessageSequence1788459540000,
  AddStudySessionCappedReason1788459600000,
  AddCoinEconomy1788459660000,
  GrantWelcomeCoins1788459720000,
  AddMissionStore1788459780000,
  AddCosmeticItemSale1788459840000,
  AddMissionRewardItems1788459960000,
  AddGuildMissionChoice1788460020000,
  KeepBadgesOffSale1788460080000,
  SeedCosmeticItemsForSale1788460140000,
  SeedMissionsForSale1788460200000,
  AddGuildChatNotices1788460260000,
  AddRaidDragonFury1788460320000,
  AddRaidMissionOwner1788460380000,
  AddWeaponCategory1788460440000,
  AddStudySessionKind1788460500000,
  SessionCountBadgeConditions1788460560000,
  AddObjectiveCoinOrigin1788460620000,
  AddStudySessionPauseCount1788460680000,
  SeedPremiumCosmeticItems1788460740000,
];

function positionOf(migration: MigrationClass): number {
  const position = APPLICATION_MIGRATIONS.indexOf(migration);
  if (position < 0) {
    throw new Error(`${migration.name} is not in APPLICATION_MIGRATIONS`);
  }
  return position;
}

/** The migrations up to `migration`, in application order, without it: the schema production had just before it. */
export function migrationsBefore(migration: MigrationClass): MigrationClass[] {
  return APPLICATION_MIGRATIONS.slice(0, positionOf(migration));
}

/** The migrations up to `migration`, in application order, including it. Newer migrations never run. */
export function migrationsThrough(migration: MigrationClass): MigrationClass[] {
  return APPLICATION_MIGRATIONS.slice(0, positionOf(migration) + 1);
}

/**
 * Undoes migrations from the top until `migration` is no longer applied.
 * `undoLastMigration()` pops by the `migrations` table order, so each step reads the last row first.
 */
export async function revertThrough(dataSource: DataSource, migration: MigrationClass): Promise<void> {
  positionOf(migration);
  const applied = async () => (await dataSource.query('SELECT name FROM migrations ORDER BY id DESC')) as Array<{ name: string }>;
  if (!(await applied()).some((row) => row.name === migration.name)) {
    throw new Error(`${migration.name} is not applied, so there is nothing to revert`);
  }
  for (let last = (await applied())[0]; last; last = (await applied())[0]) {
    await dataSource.undoLastMigration();
    if (last.name === migration.name) return;
  }
}

export interface IntegrationDatabase {
  readonly admin: Connection;
  readonly name: string;
  readonly identifier: string;
  options(migrations: NonNullable<DataSourceOptions['migrations']>): DataSourceOptions;
  close(): Promise<void>;
}

export async function createIntegrationDatabase(prefix: string): Promise<IntegrationDatabase> {
  if (!/^wise_[a-z0-9_]+$/.test(prefix)) {
    throw new Error(`Unexpected database prefix: ${prefix}`);
  }

  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = Number(process.env.TEST_DB_PORT ?? 3306);
  const username = process.env.TEST_DB_ADMIN_USERNAME ?? 'root';
  const password = process.env.TEST_DB_ADMIN_PASSWORD ?? 'change-me-root';
  const name = `${prefix}_${process.pid}_${Date.now()}`;
  const identifier = `\`${name}\``;
  const admin = await mysql.createConnection({ host, port, user: username, password });

  try {
    await admin.query(`CREATE DATABASE ${identifier}`);
  } catch (error) {
    await admin.end();
    throw error;
  }

  return {
    admin,
    name,
    identifier,
    options(migrations) {
      return {
        ...createDatabaseOptions({
          NODE_ENV: 'test',
          DB_HOST: host,
          DB_PORT: port,
          DB_USERNAME: username,
          DB_PASSWORD: password,
          DB_DATABASE: name,
        }),
        database: name,
        migrations,
        migrationsRun: false,
      };
    },
    async close() {
      try {
        await admin.query(`DROP DATABASE IF EXISTS ${identifier}`);
      } finally {
        await admin.end();
      }
    },
  };
}

/** Set by `integration-global-setup.ts`: a database with every APPLICATION_MIGRATIONS applied, built once per Jest run. */
const TEMPLATE_ENV = 'WISE_INTEGRATION_TEMPLATE_DB';

/**
 * A database with the schema and rows of every APPLICATION_MIGRATIONS, including the `migrations` table, so a
 * following `runMigrations()` has nothing left to apply. Cloning the template built by the global setup replaces
 * running all migrations again for every test. Without that setup (a single file run with plain `jest`), it is a
 * new empty database and `runMigrations()` builds the schema as before.
 */
export async function createMigratedIntegrationDatabase(prefix: string): Promise<IntegrationDatabase> {
  const database = await createIntegrationDatabase(prefix);
  const template = process.env[TEMPLATE_ENV];
  if (!template) return database;
  try {
    await cloneDatabase(database.admin, template, database.name);
  } catch (error) {
    await database.close();
    throw error;
  }
  return database;
}

async function cloneDatabase(admin: Connection, from: string, to: string): Promise<void> {
  const source = `\`${from}\``;
  const target = `\`${to}\``;
  const [tables] = await admin.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    [from],
  );
  await admin.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const { name } of tables) {
      const [[created]] = await admin.query<RowDataPacket[]>(`SHOW CREATE TABLE ${source}.\`${name}\``);
      // Foreign keys name their parent without a schema, so they resolve inside the target database.
      await admin.query((created?.['Create Table'] as string).replace(/^CREATE TABLE /, `CREATE TABLE ${target}.`));
      const [columns] = await admin.query<RowDataPacket[]>(
        "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA NOT LIKE '%GENERATED%' ORDER BY ORDINAL_POSITION",
        [from, name],
      );
      const list = columns.map((column) => `\`${column.name}\``).join(', ');
      await admin.query(`INSERT INTO ${target}.\`${name}\` (${list}) SELECT ${list} FROM ${source}.\`${name}\``);
    }
    const [triggers] = await admin.query<RowDataPacket[]>(
      'SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?',
      [from],
    );
    if (triggers.length > 0) {
      // A trigger is created in the current database, on a table named without a schema.
      await admin.query(`USE ${target}`);
      for (const { name } of triggers) {
        const [[trigger]] = await admin.query<RowDataPacket[]>(`SHOW CREATE TRIGGER ${source}.\`${name}\``);
        await admin.query(trigger?.['SQL Original Statement'] as string);
      }
    }
  } finally {
    await admin.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** Builds the template once for the whole Jest run. Used by `integration-global-setup.ts`. */
export async function createIntegrationTemplate(): Promise<void> {
  const database = await createIntegrationDatabase('wise_template');
  const dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
  } catch (error) {
    await database.close();
    throw error;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
  await database.admin.end();
  process.env[TEMPLATE_ENV] = database.name;
}

/** Drops the template. Used by `integration-global-teardown.ts`. */
export async function dropIntegrationTemplate(): Promise<void> {
  const template = process.env[TEMPLATE_ENV];
  if (!template) return;
  const admin = await mysql.createConnection({
    host: process.env.TEST_DB_HOST ?? 'localhost',
    port: Number(process.env.TEST_DB_PORT ?? 3306),
    user: process.env.TEST_DB_ADMIN_USERNAME ?? 'root',
    password: process.env.TEST_DB_ADMIN_PASSWORD ?? 'change-me-root',
  });
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${template}\``);
  } finally {
    await admin.end();
  }
}
