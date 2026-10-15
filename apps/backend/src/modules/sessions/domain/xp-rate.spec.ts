import { xpForDuration } from './xp-rate';

describe('xpForDuration', () => {
  afterEach(() => {
    delete process.env.XP_PER_MINUTE;
  });

  it('awards 10 XP per complete minute by default', () => {
    expect(xpForDuration(300)).toBe(50);
    expect(xpForDuration(1500)).toBe(250);
    expect(xpForDuration(359)).toBe(50);
  });

  it('reads XP_PER_MINUTE from the environment', () => {
    process.env.XP_PER_MINUTE = '5';
    expect(xpForDuration(1500)).toBe(125);
  });

  it('falls back to the default for an invalid XP_PER_MINUTE', () => {
    process.env.XP_PER_MINUTE = 'abc';
    expect(xpForDuration(60)).toBe(10);
  });
});
