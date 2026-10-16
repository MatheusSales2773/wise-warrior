import { coinsForDuration } from './coin-rate';

describe('coinsForDuration', () => {
  afterEach(() => {
    delete process.env.COINS_PER_FOCUS_MINUTES_DIVISOR;
  });

  it('gives one Moeda per two complete minutes of valid focus by default', () => {
    expect(coinsForDuration(1500)).toBe(12);
    expect(coinsForDuration(300)).toBe(2);
    expect(coinsForDuration(359)).toBe(2);
  });

  it('gives nothing below five minutes of valid focus', () => {
    expect(coinsForDuration(299)).toBe(0);
    expect(coinsForDuration(0)).toBe(0);
  });

  it('pays in proportion when the session stops early', () => {
    expect(coinsForDuration(660)).toBe(5);
  });

  it('pays on the truncated focus of a capped session, so four hours give 120', () => {
    expect(coinsForDuration(14_400)).toBe(120);
  });

  it('reads COINS_PER_FOCUS_MINUTES_DIVISOR from the environment', () => {
    process.env.COINS_PER_FOCUS_MINUTES_DIVISOR = '1';
    expect(coinsForDuration(1500)).toBe(25);
  });

  it('falls back to the default divisor for an invalid value', () => {
    process.env.COINS_PER_FOCUS_MINUTES_DIVISOR = 'abc';
    expect(coinsForDuration(1500)).toBe(12);
    process.env.COINS_PER_FOCUS_MINUTES_DIVISOR = '0.5';
    expect(coinsForDuration(1500)).toBe(12);
  });
});
