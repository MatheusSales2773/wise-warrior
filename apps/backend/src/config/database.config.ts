import { join } from 'node:path';
import type { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';

export interface DatabaseEnvironment {
  NODE_ENV?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_DATABASE?: string;
}

/**
 * Paths are relative to this module so the same options work with ts-node
 * from src/config and with the compiled application from dist/config.
 */
export function getEntityPaths(): string[] {
  return [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')];
}

export function getMigrationPaths(): string[] {
  const extension = __filename.endsWith('.js') ? '.js' : '.ts';
  return [join(__dirname, `../migrations/[0-9]*${extension}`)];
}

/**
 * Shared by Nest runtime and the TypeORM CLI. Schema synchronization is
 * deliberately disabled in every environment; production applies the
 * versioned migrations during DataSource initialization.
 */
export type MySqlDatabaseOptions = MysqlConnectionOptions;

export function createDatabaseOptions(
  environment: DatabaseEnvironment = process.env,
): MySqlDatabaseOptions {
  const isProduction = environment.NODE_ENV === 'production';

  return {
    type: 'mysql',
    host: environment.DB_HOST ?? 'localhost',
    port: Number(environment.DB_PORT ?? 3306),
    username: environment.DB_USERNAME ?? 'wise',
    password: environment.DB_PASSWORD ?? 'change-me',
    database: environment.DB_DATABASE ?? 'wise',
    entities: getEntityPaths(),
    migrations: getMigrationPaths(),
    synchronize: false,
    migrationsRun: isProduction,
    migrationsTableName: 'migrations',
    extra: { connectionLimit: 5 },
  };
}
