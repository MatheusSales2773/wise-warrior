import {
  createDatabaseOptions,
  getEntityPaths,
  getMigrationPaths,
} from './database.config';

describe('createDatabaseOptions', () => {
  it('enables versioned migrations in production or when explicitly requested', () => {
    const production = createDatabaseOptions({ NODE_ENV: 'production' });
    const development = createDatabaseOptions({ NODE_ENV: 'development' });
    const test = createDatabaseOptions({ NODE_ENV: 'test' });
    const disposableTest = createDatabaseOptions({
      NODE_ENV: 'test',
      DB_MIGRATIONS_RUN: 'true',
    });

    expect(production.synchronize).toBe(false);
    expect(production.migrationsRun).toBe(true);
    expect(development.synchronize).toBe(false);
    expect(development.migrationsRun).toBe(false);
    expect(test.synchronize).toBe(false);
    expect(test.migrationsRun).toBe(false);
    expect(disposableTest.synchronize).toBe(false);
    expect(disposableTest.migrationsRun).toBe(true);
  });

  it('resolves source paths that become dist paths after compilation', () => {
    expect(getEntityPaths()[0]).toMatch(/modules\/\*\*\/entities/);
    expect(getMigrationPaths()[0]).toMatch(/migrations\/\[0-9\]\*\.ts$/);
  });
});
