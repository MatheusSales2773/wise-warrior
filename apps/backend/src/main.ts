import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // app.init() waits for TypeORM DataSource.initialize(), including the
  // production migrationsRun phase, before any HTTP listener is opened.
  await app.init();
  if (!app.get(DataSource).isInitialized) {
    throw new Error('TypeORM DataSource was not initialized');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Backend bootstrap failed', error);
  process.exitCode = 1;
});
