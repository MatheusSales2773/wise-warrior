import type { Request } from 'express';
import type { CorsOptions } from 'cors';
import {
  DEFAULT_CORS_ORIGIN,
  createCorsOptionsDelegate,
  isNativeAuthPath,
  parseCorsOrigins,
} from './cors.config';

function optionsFor(path: string, raw: string | undefined): CorsOptions {
  const delegate = createCorsOptionsDelegate(raw);
  let captured: CorsOptions | undefined;
  delegate({ path, headers: {} } as unknown as Request, (_error, options) => {
    captured = options;
  });
  if (!captured) {
    throw new Error('CORS delegate did not produce options');
  }
  return captured;
}

describe('parseCorsOrigins', () => {
  it('falls back to the Metro Web development default when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(parseCorsOrigins('')).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(parseCorsOrigins('   ')).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('splits, trims and normalizes a comma separated allowlist', () => {
    expect(
      parseCorsOrigins(' http://localhost:8081 , https://app.example.com/ '),
    ).toEqual(['http://localhost:8081', 'https://app.example.com']);
  });

  it('rejects wildcard origins because credentials are enabled', () => {
    expect(() => parseCorsOrigins('*')).toThrow(/wildcard/i);
    expect(() => parseCorsOrigins('https://app.example.com,*')).toThrow(
      /wildcard/i,
    );
  });

  it('rejects an allowlist that only contains separators', () => {
    expect(() => parseCorsOrigins(' , ')).toThrow(/at least one origin/i);
  });

  it('fails closed instead of defaulting to localhost in production', () => {
    expect(() => parseCorsOrigins(undefined, 'production')).toThrow(
      /production/i,
    );
  });
});

describe('isNativeAuthPath', () => {
  it.each([
    ['/api/v1/auth/native', true],
    ['/api/v1/auth/native/login', true],
    ['/api/v1/auth/native/refresh?foo=bar', true],
    ['/auth/native/logout', true],
    ['/api/v1/auth/login', false],
    ['/api/v1/auth/nativex', false],
  ])('classifies %s as native=%s', (path, expected) => {
    expect(isNativeAuthPath(path)).toBe(expected);
  });
});

describe('createCorsOptionsDelegate', () => {
  it('never grants CORS to native endpoints', () => {
    expect(
      optionsFor('/api/v1/auth/native/login', 'http://localhost:8081'),
    ).toEqual({ origin: false });
  });

  it('grants credentials only to the configured Web allowlist', () => {
    expect(
      optionsFor('/api/v1/auth/login', 'http://localhost:8081,https://app.example.com'),
    ).toEqual({
      origin: ['http://localhost:8081', 'https://app.example.com'],
      credentials: true,
    });
  });

  it('uses the development default for Web when unset', () => {
    expect(optionsFor('/api/v1/auth/login', undefined)).toEqual({
      origin: [DEFAULT_CORS_ORIGIN],
      credentials: true,
    });
  });
});
