import { isUnlockedAtLevel, parseUnlockCondition } from './unlock-condition';

describe('parseUnlockCondition', () => {
  it('reads a level condition', () => {
    expect(parseUnlockCondition('level:5')).toEqual({ type: 'level', level: 5 });
  });

  it('reads a raid condition, including the any-raid wildcard', () => {
    expect(parseUnlockCondition('raid:dragao-do-pantano')).toEqual({ type: 'raid', slug: 'dragao-do-pantano' });
    expect(parseUnlockCondition('raid:*')).toEqual({ type: 'raid', slug: '*' });
  });

  it.each(['level:0', 'level:-1', 'level:1.5', 'level:', 'raid:', 'achievement:x', ''])(
    'rejects the malformed condition %p',
    (raw) => {
      expect(() => parseUnlockCondition(raw)).toThrow('Condição de desbloqueio inválida');
    },
  );
});

describe('isUnlockedAtLevel', () => {
  it('unlocks level conditions at or below the character level', () => {
    expect(isUnlockedAtLevel({ type: 'level', level: 3 }, 3)).toBe(true);
    expect(isUnlockedAtLevel({ type: 'level', level: 3 }, 2)).toBe(false);
  });

  it('never unlocks raid conditions by level', () => {
    expect(isUnlockedAtLevel({ type: 'raid', slug: '*' }, 99)).toBe(false);
  });
});
