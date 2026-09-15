import type { Connection } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import type { DataSourceOptions } from 'typeorm';
import { createDatabaseOptions } from '../config/database.config';
import { AddSessionRefreshTokenHistory1788458460000 } from '../migrations/1788458460000-add-session-refresh-token-history';
import { CreateWiseSchema1788458400000 } from '../migrations/1788458400000-create-wise-schema';

export const APPLICATION_MIGRATIONS: NonNullable<DataSourceOptions['migrations']> = [
  CreateWiseSchema1788458400000,
  AddSessionRefreshTokenHistory1788458460000,
];

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
