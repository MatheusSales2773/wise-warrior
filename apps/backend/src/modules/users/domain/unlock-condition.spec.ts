import { isStarterItem, isUnlockedAtLevel, isUnlockedBySessionCounts, parseUnlockCondition } from './unlock-condition';

describe('parseUnlockCondition', () => {
  it('reads a level condition', () => {
    expect(parseUnlockCondition('level:5')).toEqual({ type: 'level', level: 5 });
  });

  it('reads a raid condition, including the any-raid wildcard', () => {
    expect(parseUnlockCondition('raid:dragao-do-pantano')).toEqual({ type: 'raid', slug: 'dragao-do-pantano' });
    expect(parseUnlockCondition('raid:*')).toEqual({ type: 'raid', slug: '*' });
  });

  it('reads the session-count conditions', () => {
    expect(parseUnlockCondition('sessions:100')).toEqual({ type: 'sessions', count: 100 });
    expect(parseUnlockCondition('early-sessions:5')).toEqual({ type: 'early-sessions', count: 5 });
  });

  it.each(['sessions:0', 'sessions:', 'sessions:1.5', 'early-sessions:-1', 'early-sessions:', 'early-sessions:x', 'level:0', 'level:-1', 'level:1.5', 'level:', 'raid:', 'achievement:x', ''])(
    'reads the malformed condition %p as no condition',
    (raw) => {
      expect(parseUnlockCondition(raw)).toBeNull();
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

describe('isUnlockedBySessionCounts', () => {
  const counts = { sessions: 100, earlySessions: 4 };

  it('unlocks each count condition against its own count', () => {
    expect(isUnlockedBySessionCounts({ type: 'sessions', count: 100 }, counts)).toBe(true);
    expect(isUnlockedBySessionCounts({ type: 'sessions', count: 101 }, counts)).toBe(false);
    expect(isUnlockedBySessionCounts({ type: 'early-sessions', count: 4 }, counts)).toBe(true);
    expect(isUnlockedBySessionCounts({ type: 'early-sessions', count: 5 }, counts)).toBe(false);
  });

  it('never unlocks level, raid or purchase conditions', () => {
    expect(isUnlockedBySessionCounts({ type: 'level', level: 1 }, counts)).toBe(false);
    expect(isUnlockedBySessionCounts({ type: 'raid', slug: '*' }, counts)).toBe(false);
    expect(isUnlockedBySessionCounts({ type: 'purchase' }, counts)).toBe(false);
  });

  it('does not unlock level conditions by session count nor session conditions by level', () => {
    expect(isUnlockedAtLevel({ type: 'sessions', count: 1 }, 99)).toBe(false);
    expect(isUnlockedAtLevel({ type: 'early-sessions', count: 1 }, 99)).toBe(false);
  });
});

describe('isStarterItem', () => {
  it('marks only level-1 conditions as starter items', () => {
    expect(isStarterItem({ type: 'level', level: 1 })).toBe(true);
    expect(isStarterItem({ type: 'level', level: 3 })).toBe(false);
    expect(isStarterItem({ type: 'raid', slug: '*' })).toBe(false);
  });
});
