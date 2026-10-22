import { buildCadence, calculateStreaks, groupActivityByDay } from './session-metrics';

describe('session metrics domain', () => {
  it('allows a current streak to start yesterday when today is inactive', () => {
    expect(calculateStreaks(['2026-09-14', '2026-09-15', '2026-09-16'], '2026-09-17')).toEqual({
      currentStreakDays: 3,
      longestStreakDays: 3,
    });
  });

  it('does not carry the current streak across a gap and finds historical maximum', () => {
    expect(calculateStreaks([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
      '2026-09-01', '2026-09-03', '2026-09-04', '2026-09-05',
    ], '2026-09-06')).toEqual({
      currentStreakDays: 3,
      longestStreakDays: 5,
    });
  });

  it('fills the inclusive cadence window', () => {
    expect(buildCadence([{ date: '2026-09-02', sessionCount: 5, validSeconds: 60 }], '2026-09-01', '2026-09-03')).toEqual([
      { date: '2026-09-01', sessionCount: 0, validSeconds: 0 },
      { date: '2026-09-02', sessionCount: 5, validSeconds: 60 },
      { date: '2026-09-03', sessionCount: 0, validSeconds: 0 },
    ]);
  });

  it('folds UTC hours into the days the given day key names', () => {
    const dayKeyOf = (instant: Date) => new Date(instant.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    expect(groupActivityByDay([
      { hour: '2026-09-18 02', sessionCount: 1, validSeconds: 100 },
      { hour: '2026-09-17 15', sessionCount: 2, validSeconds: 200 },
      { hour: '2026-09-18 03', sessionCount: 1, validSeconds: 50 },
    ], dayKeyOf)).toEqual([
      { date: '2026-09-17', sessionCount: 3, validSeconds: 300 },
      { date: '2026-09-18', sessionCount: 1, validSeconds: 50 },
    ]);
  });
});
