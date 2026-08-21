import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Usado apenas pela CLI do TypeORM (`npm run migration:generate`/`run`).
 * O NestJS em runtime usa `TypeOrmModule.forRootAsync` (app.module.ts),
 * que lê a mesma configuração via ConfigService.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'wise_warrior',
  password: process.env.DB_PASSWORD ?? 'change-me',
  database: process.env.DB_DATABASE ?? 'wise_warrior',
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  extra: { connectionLimit: 5 },
});
