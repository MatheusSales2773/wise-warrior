import { ConfigService } from '@nestjs/config';
import { createRateLimitOptions } from './rate-limit';

function optionsFor(values: Record<string, string>) {
  return Object.fromEntries(
    createRateLimitOptions(new ConfigService(values)).map(({ name, limit, ttl }) => [name, { limit, ttl }]),
  );
}

describe('createRateLimitOptions', () => {
  it('uses the documented defaults when nothing is configured', () => {
    expect(optionsFor({})).toEqual({
      credentials: { limit: 10, ttl: 60_000 },
      refresh: { limit: 30, ttl: 60_000 },
      'study-session': { limit: 60, ttl: 60_000 },
      shop: { limit: 30, ttl: 60_000 },
      'mission-choice': { limit: 30, ttl: 60_000 },
    });
  });

  it('treats the empty strings Docker Compose passes for unset variables as the default', () => {
    expect(optionsFor({ RATE_LIMIT_CREDENTIALS_LIMIT: '', RATE_LIMIT_CREDENTIALS_TTL_SECONDS: ' ' }).credentials).toEqual({
      limit: 10,
      ttl: 60_000,
    });
  });

  it('reads each limit and window from its own variables', () => {
    expect(optionsFor({ RATE_LIMIT_STUDY_SESSION_LIMIT: '5', RATE_LIMIT_STUDY_SESSION_TTL_SECONDS: '30' })['study-session']).toEqual({
      limit: 5,
      ttl: 30_000,
    });
  });
});
