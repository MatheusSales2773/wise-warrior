import {
  createDatabaseOptions,
  getEntityPaths,
  getMigrationPaths,
} from './database.config';

describe('createDatabaseOptions', () => {
  it('enables versioned migrations only in production', () => {
    const production = createDatabaseOptions({ NODE_ENV: 'production' });
    const development = createDatabaseOptions({ NODE_ENV: 'development' });
    const test = createDatabaseOptions({ NODE_ENV: 'test' });

    expect(production.synchronize).toBe(false);
    expect(production.migrationsRun).toBe(true);
    expect(development.synchronize).toBe(false);
    expect(development.migrationsRun).toBe(false);
    expect(test.synchronize).toBe(false);
    expect(test.migrationsRun).toBe(false);
  });

  it('resolves source paths that become dist paths after compilation', () => {
    expect(getEntityPaths()[0]).toMatch(/modules\/\*\*\/entities/);
    expect(getMigrationPaths()[0]).toMatch(/migrations\/\[0-9\]\*\.ts$/);
  });
});
