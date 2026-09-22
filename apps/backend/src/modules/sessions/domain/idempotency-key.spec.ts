import { isValidIdempotencyKey } from './idempotency-key';

describe('idempotency key validation', () => {
  it('accepts visible ASCII keys up to 128 characters', () => {
    expect(isValidIdempotencyKey('request-1')).toBe(true);
    expect(isValidIdempotencyKey('!'.repeat(128))).toBe(true);
  });

  it('rejects missing, empty, oversized, whitespace, and non-ASCII keys', () => {
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey('!'.repeat(129))).toBe(false);
    expect(isValidIdempotencyKey('request key')).toBe(false);
    expect(isValidIdempotencyKey('ação')).toBe(false);
  });
});
