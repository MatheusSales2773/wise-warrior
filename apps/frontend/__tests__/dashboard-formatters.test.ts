import { formatCadenceDate, formatDayCount, formatDiscardReason, formatDuration, formatSessionDate, formatSessionsToday, formatXp, levelProgressPercent } from '@/features/dashboard/formatters';

describe('dashboard formatters', () => {
  it('formats values for pt-BR without inventing units', () => {
    expect(formatXp(1234567)).toBe('1.234.567');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min');
    expect(formatDiscardReason('HEARTBEAT_TIMEOUT')).toBe('Sessão não contabilizada');
    expect(formatDiscardReason(null)).toBe('');
    expect(formatCadenceDate('2026-01-02')).toBe('02/01');
  });

  it('formats an absolute local date and time', () => {
    expect(formatSessionDate('2026-01-02T03:04:05.000Z')).toMatch(/02\/01\/2026/);
  });

  it('pluralizes day counts', () => {
    expect(formatDayCount(0)).toBe('0 dias');
    expect(formatDayCount(1)).toBe('1 dia');
    expect(formatDayCount(2)).toBe('2 dias');
  });

  it('measures level progress as a rounded percentage capped at 100', () => {
    expect(levelProgressPercent({ xpTotal: 150, levelStartXp: 100, nextLevelXp: 200 })).toBe(50);
    expect(levelProgressPercent({ xpTotal: 100, levelStartXp: 100, nextLevelXp: 200 })).toBe(0);
    expect(levelProgressPercent({ xpTotal: 1, levelStartXp: 0, nextLevelXp: 3 })).toBe(33);
    expect(levelProgressPercent({ xpTotal: 2, levelStartXp: 0, nextLevelXp: 3 })).toBe(67);
    expect(levelProgressPercent({ xpTotal: 250, levelStartXp: 100, nextLevelXp: 200 })).toBe(100);
  });

  it('does not divide by zero when the level span is empty', () => {
    expect(levelProgressPercent({ xpTotal: 100, levelStartXp: 100, nextLevelXp: 100 })).toBe(0);
  });

  it('describes sessions today against the daily goal', () => {
    expect(formatSessionsToday({ sessionsToday: 3, dailyGoal: 5 })).toEqual({ value: '3 / 5', spoken: '3 de 5' });
    expect(formatSessionsToday({ sessionsToday: 0, dailyGoal: 5 })).toEqual({ value: '0 / 5', spoken: '0 de 5' });
    expect(formatSessionsToday({ sessionsToday: 3, dailyGoal: 0 })).toEqual({ value: '3', spoken: '3' });
    expect(formatSessionsToday({ sessionsToday: 3, dailyGoal: -2 })).toEqual({ value: '3', spoken: '3' });
  });
});
