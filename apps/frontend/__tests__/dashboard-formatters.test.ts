import { formatCadenceDate, formatDayCount, formatDiscardReason, formatDuration, formatFocusMinutes, formatFocusSeconds, formatWeeklyFocusLine, topWeekSubjects, formatSessionDate, formatSessionsToday, formatXp, levelProgressPercent } from '@/features/dashboard/formatters';

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

  it('describes the progress and target of the "Conclua 4 sessões hoje" Objetivo', () => {
    expect(formatSessionsToday(3, { progress: 3, target: 5 })).toEqual({ value: '3 / 5', spoken: '3 de 5' });
    expect(formatSessionsToday(0, { progress: 0, target: 5 })).toEqual({ value: '0 / 5', spoken: '0 de 5' });
  });

  it('shows only the session count while the Objetivo is unknown', () => {
    expect(formatSessionsToday(3, undefined)).toEqual({ value: '3', spoken: '3' });
  });

  it('formats focus minutes with hours only when there are any', () => {
    expect(formatFocusMinutes(0)).toBe('0min');
    expect(formatFocusMinutes(50)).toBe('50min');
    expect(formatFocusMinutes(60)).toBe('1h');
    expect(formatFocusMinutes(220)).toBe('3h 40min');
    expect(formatFocusMinutes(300)).toBe('5h');
  });

  it('floors seconds of focus to whole minutes', () => {
    expect(formatFocusSeconds(4_259)).toBe('1h 10min');
    expect(formatFocusSeconds(59)).toBe('0min');
  });

  it('describes the weekly minutes Objetivo, or falls back to the valid focus of today', () => {
    expect(formatWeeklyFocusLine({ progress: 220, target: 300 }, 4_200)).toBe('Semana: 3h 40min de 5h');
    expect(formatWeeklyFocusLine(undefined, 4_200)).toBe('70 min de foco válido');
  });

  it('keeps the first three subjects of the week in the given order', () => {
    const subjects = ['a', 'b', 'c', 'd'].map((subject, index) => ({ subject, validSeconds: 100 - index }));
    expect(topWeekSubjects(subjects).map(({ subject }) => subject)).toEqual(['a', 'b', 'c']);
    expect(topWeekSubjects(undefined)).toEqual([]);
  });
});
