import { buildWeekSummary, NO_SUBJECT_LABEL, type WeekSessionRow } from './week-summary';

// Thursday 2026-10-22 12:00 in São Paulo (UTC-3): the week runs from 2026-10-19 to 2026-10-25.
const NOW = new Date('2026-10-22T15:00:00Z');

const session = (endedAt: string, overrides: Partial<WeekSessionRow> = {}): WeekSessionRow => ({
  endedAt: new Date(endedAt),
  subject: 'Cálculo II',
  validSeconds: 1500,
  xpAwarded: 100,
  ...overrides,
});

describe('buildWeekSummary', () => {
  it('names the São Paulo week, Monday to Sunday, and always lists seven days', () => {
    const summary = buildWeekSummary([], NOW);

    expect(summary).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25', today: '2026-10-22' });
    expect(summary.days.map((day) => day.date)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(summary).toMatchObject({ validSeconds: 0, sessionCount: 0, xp: 0, subjects: [] });
  });

  it('sums focus, sessions and XP, and buckets each session on the São Paulo day it ended', () => {
    const summary = buildWeekSummary([
      session('2026-10-19T13:00:00Z'),
      session('2026-10-19T14:00:00Z', { validSeconds: 600, xpAwarded: 40 }),
      session('2026-10-22T12:00:00Z', { validSeconds: 3000, xpAwarded: 200 }),
    ], NOW);

    expect(summary).toMatchObject({ validSeconds: 5100, sessionCount: 3, xp: 340 });
    expect(summary.days[0]).toEqual({ date: '2026-10-19', validSeconds: 2100, sessionCount: 2 });
    expect(summary.days[3]).toEqual({ date: '2026-10-22', validSeconds: 3000, sessionCount: 1 });
    expect(summary.days[1]).toEqual({ date: '2026-10-20', validSeconds: 0, sessionCount: 0 });
  });

  it('keeps Sunday 23:59 in the week and leaves out Monday 00:00 of the next one', () => {
    const summary = buildWeekSummary([
      session('2026-10-26T02:59:59Z', { validSeconds: 100, xpAwarded: 1 }), // Sunday 23:59:59 in São Paulo
      session('2026-10-26T03:00:00Z', { validSeconds: 999, xpAwarded: 9 }), // Monday 00:00:00, next week
      session('2026-10-19T02:59:59Z', { validSeconds: 888, xpAwarded: 8 }), // Sunday 23:59:59, previous week
      session('2026-10-19T03:00:00Z', { validSeconds: 200, xpAwarded: 2 }), // Monday 00:00:00 in São Paulo
    ], NOW);

    expect(summary).toMatchObject({ validSeconds: 300, sessionCount: 2, xp: 3 });
    expect(summary.days[0]).toMatchObject({ validSeconds: 200, sessionCount: 1 });
    expect(summary.days[6]).toMatchObject({ validSeconds: 100, sessionCount: 1 });
  });

  it('groups subjects ignoring case and edge spaces, as one subject', () => {
    const summary = buildWeekSummary([
      session('2026-10-20T13:00:00Z', { subject: 'Cálculo II', validSeconds: 1000 }),
      session('2026-10-21T13:00:00Z', { subject: ' cálculo ii ', validSeconds: 500 }),
      session('2026-10-21T15:00:00Z', { subject: 'CÁLCULO II', validSeconds: 250 }),
    ], NOW);

    expect(summary.subjects).toEqual([{ subject: 'CÁLCULO II', validSeconds: 1750 }]);
  });

  it('files sessions without a subject under "Sem matéria"', () => {
    const summary = buildWeekSummary([
      session('2026-10-20T13:00:00Z', { subject: null, validSeconds: 400 }),
      session('2026-10-20T14:00:00Z', { subject: '   ', validSeconds: 100 }),
    ], NOW);

    expect(NO_SUBJECT_LABEL).toBe('Sem matéria');
    expect(summary.subjects).toEqual([{ subject: 'Sem matéria', validSeconds: 500 }]);
  });

  it('keeps the four subjects with the most focus, ordered, breaking ties by name', () => {
    const summary = buildWeekSummary([
      session('2026-10-20T13:00:00Z', { subject: 'E', validSeconds: 100 }),
      session('2026-10-20T13:00:00Z', { subject: 'D', validSeconds: 400 }),
      session('2026-10-20T13:00:00Z', { subject: 'C', validSeconds: 300 }),
      session('2026-10-20T13:00:00Z', { subject: 'B', validSeconds: 300 }),
      session('2026-10-20T13:00:00Z', { subject: 'A', validSeconds: 900 }),
    ], NOW);

    expect(summary.subjects.map((subject) => subject.subject)).toEqual(['A', 'D', 'B', 'C']);
  });
});
