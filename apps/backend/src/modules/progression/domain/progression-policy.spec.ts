import { applyXp, levelForXp, xpThresholdForLevel } from './progression-policy';

describe('xpThresholdForLevel', () => {
  it('requires 0 XP for level 1 (starting level)', () => {
    expect(xpThresholdForLevel(1)).toBe(0);
  });

  it('requires 500 * N^1.5 XP for level N > 1', () => {
    expect(xpThresholdForLevel(2)).toBe(Math.round(500 * 2 ** 1.5));
    expect(xpThresholdForLevel(5)).toBe(Math.round(500 * 5 ** 1.5));
  });
});

describe('levelForXp', () => {
  it('returns level 1 for 0 XP', () => {
    expect(levelForXp(0)).toBe(1);
  });

  it('returns level 1 just below the level-2 threshold', () => {
    const threshold = xpThresholdForLevel(2);
    expect(levelForXp(threshold - 1)).toBe(1);
  });

  it('returns level 2 exactly at the level-2 threshold', () => {
    const threshold = xpThresholdForLevel(2);
    expect(levelForXp(threshold)).toBe(2);
  });

  it('skips directly to the correct level for a large XP jump', () => {
    const threshold5 = xpThresholdForLevel(5);
    expect(levelForXp(threshold5 + 1)).toBe(5);
  });

  it('throws for negative XP', () => {
    expect(() => levelForXp(-1)).toThrow();
  });
});

describe('applyXp', () => {
  it('accumulates XP without leveling up when below the next threshold', () => {
    const result = applyXp(0, 100);
    expect(result).toEqual({
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
      newXpTotal: 100,
    });
  });

  it('flags leveledUp when XP crosses the next threshold', () => {
    const threshold = xpThresholdForLevel(2);
    const result = applyXp(threshold - 10, 10);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
    expect(result.newXpTotal).toBe(threshold);
  });

  it('can level up multiple levels in a single award', () => {
    const threshold5 = xpThresholdForLevel(5);
    const result = applyXp(0, threshold5);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(5);
    expect(result.leveledUp).toBe(true);
  });

  it('throws for negative xpGained', () => {
    expect(() => applyXp(0, -1)).toThrow();
  });
});
