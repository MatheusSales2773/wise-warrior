import { MAX_SUPPORTED_XP_TOTAL } from './domain/progression-policy';
import { XpTotalTransformer } from './xp-total.transformer';

describe('XpTotalTransformer', () => {
  const transformer = new XpTotalTransformer();

  it.each([
    ['0', 0],
    ['9000000000000000', MAX_SUPPORTED_XP_TOTAL],
    [42, 42],
  ])('normalizes %p to %p on read', (value, expected) => {
    expect(transformer.from(value)).toBe(expected);
  });

  it('writes an exact decimal string', () => {
    expect(transformer.to(MAX_SUPPORTED_XP_TOTAL)).toBe('9000000000000000');
  });

  it.each(['', '1.5', '-1', '9000000000000001', 'not-a-number'])(
    'rejects invalid persisted value %p',
    (value) => {
      expect(() => transformer.from(value)).toThrow();
    },
  );

  it.each([NaN, Infinity, -1, 1.5, MAX_SUPPORTED_XP_TOTAL + 1])(
    'rejects invalid entity value %p',
    (value) => {
      expect(() => transformer.to(value)).toThrow();
    },
  );
});
