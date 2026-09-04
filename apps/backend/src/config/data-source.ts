import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database.config';

/**
 * Usado apenas pela CLI do TypeORM (`npm run migration:generate`/`run`).
 * O NestJS em runtime usa `TypeOrmModule.forRootAsync` (app.module.ts),
 * que lê a mesma configuração via ConfigService.
 */
export const AppDataSource = new DataSource(createDatabaseOptions());
