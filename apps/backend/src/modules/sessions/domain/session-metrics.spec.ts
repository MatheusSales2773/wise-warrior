import { buildCadence, calculateStreaks } from './session-metrics';

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
});
