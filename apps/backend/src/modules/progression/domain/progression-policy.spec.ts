import {
  applyXp,
  levelForXp,
  MAX_SUPPORTED_XP_TOTAL,
  xpThresholdForLevel,
} from './progression-policy';

function referenceXpThresholdForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  return Math.round(500 * level ** 1.5);
}

function referenceLevelForXpLinear(xpTotal: number): number {
  let level = 1;
  while (referenceXpThresholdForLevel(level + 1) <= xpTotal) {
    level += 1;
  }
  return level;
}

function referenceLevelForXpBinary(xpTotal: number): number {
  let lowerLevel = 1;
  let upperLevel = 1_000_000_001;
  while (lowerLevel < upperLevel) {
    const candidateLevel = lowerLevel + Math.floor((upperLevel - lowerLevel) / 2);
    if (referenceXpThresholdForLevel(candidateLevel) <= xpTotal) {
      lowerLevel = candidateLevel + 1;
    } else {
      upperLevel = candidateLevel;
    }
  }
  return lowerLevel - 1;
}

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

  it('preserves rounded thresholds at representative high levels', () => {
    for (const level of [2, 5, 100, 10_000, 500_000]) {
      const threshold = referenceXpThresholdForLevel(level);

      for (const xpTotal of [threshold - 1, threshold, threshold + 1]) {
        expect(levelForXp(xpTotal)).toBe(referenceLevelForXpLinear(xpTotal));
      }
    }
  });

  it('resolves the supported XP ceiling against an independent oracle', () => {
    expect(levelForXp(MAX_SUPPORTED_XP_TOTAL)).toBe(
      referenceLevelForXpBinary(MAX_SUPPORTED_XP_TOTAL),
    );
  });

  it('throws for negative XP', () => {
    expect(() => levelForXp(-1)).toThrow();
  });

  it.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])(
    'throws for invalid XP value %p',
    (xp) => {
      expect(() => levelForXp(xp)).toThrow();
    },
  );
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

  it('rejects a checked addition above the supported total', () => {
    expect(() => applyXp(MAX_SUPPORTED_XP_TOTAL, 1)).toThrow();
  });

  it('accepts the supported total boundary', () => {
    expect(applyXp(MAX_SUPPORTED_XP_TOTAL - 1, 1).newXpTotal).toBe(
      MAX_SUPPORTED_XP_TOTAL,
    );
  });
});
