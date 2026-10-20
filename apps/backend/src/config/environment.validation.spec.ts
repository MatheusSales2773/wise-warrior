import { MIN_SECRET_LENGTH, validateEnvironment } from './environment.validation';

const strongSecret = 'k'.repeat(MIN_SECRET_LENGTH);

const production = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: strongSecret,
  DB_PASSWORD: 'a-real-database-password',
  CORS_ORIGIN: 'https://wise.example.com',
};

describe('validateEnvironment', () => {
  it('accepts a complete production configuration and returns it unchanged', () => {
    expect(validateEnvironment({ ...production })).toEqual(production);
  });

  it('keeps development and test free of the production requirements', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => validateEnvironment({ NODE_ENV: 'test', JWT_ACCESS_SECRET: 'short' })).not.toThrow();
  });

  it.each([
    ['a missing access secret', { JWT_ACCESS_SECRET: undefined }, 'JWT_ACCESS_SECRET é obrigatório'],
    ['a short access secret', { JWT_ACCESS_SECRET: 'short-secret' }, `ao menos ${MIN_SECRET_LENGTH} caracteres`],
    ['the .env.example access secret', { JWT_ACCESS_SECRET: `change-me-access-${strongSecret}` }, 'JWT_ACCESS_SECRET não pode ser um valor de exemplo'],
    ['a missing database password', { DB_PASSWORD: '  ' }, 'DB_PASSWORD é obrigatório'],
    ['the .env.example database password', { DB_PASSWORD: 'change-me' }, 'DB_PASSWORD não pode ser um valor de exemplo'],
    ['a missing CORS origin', { CORS_ORIGIN: undefined }, 'CORS_ORIGIN é obrigatório'],
  ])('refuses to boot production with %s', (_case, override, message) => {
    expect(() => validateEnvironment({ ...production, ...override })).toThrow(message);
  });

  it('reports every problem at once', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /JWT_ACCESS_SECRET[\s\S]*DB_PASSWORD[\s\S]*CORS_ORIGIN/,
    );
  });

  it('never echoes a secret value in the error', () => {
    const leakedSecret = 'change-me-but-this-is-the-real-one-1234567890';
    try {
      validateEnvironment({ ...production, JWT_ACCESS_SECRET: leakedSecret, DB_PASSWORD: 'change-me-too' });
      throw new Error('expected validation to fail');
    } catch (error) {
      expect((error as Error).message).not.toContain(leakedSecret);
      expect((error as Error).message).not.toContain('change-me-too');
    }
  });

  it('rejects rate limit settings that are not positive integers in any environment', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development', RATE_LIMIT_CREDENTIALS_LIMIT: '0' })).toThrow(
      'RATE_LIMIT_CREDENTIALS_LIMIT deve ser um inteiro positivo',
    );
    expect(() => validateEnvironment({ RATE_LIMIT_STUDY_SESSION_TTL_SECONDS: '1.5' })).toThrow(
      'RATE_LIMIT_STUDY_SESSION_TTL_SECONDS',
    );
    expect(() => validateEnvironment({ RATE_LIMIT_REFRESH_LIMIT: '30' })).not.toThrow();
  });
});
