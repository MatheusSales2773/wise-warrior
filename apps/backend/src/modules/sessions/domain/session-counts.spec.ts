import { countSessions } from './session-counts';

const hour = (utc: string, sessionCount: number) => ({ hour: utc, sessionCount, validSeconds: 0 });

describe('countSessions', () => {
  it('counts every session and, of them, those that ended before 7h in São Paulo', () => {
    expect(
      countSessions([
        hour('2026-09-18 09', 2), // 06h in São Paulo
        hour('2026-09-18 10', 3), // 07h in São Paulo
        hour('2026-09-18 03', 1), // 00h in São Paulo
        hour('2026-09-18 02', 4), // 23h of the previous day
      ]),
    ).toEqual({ sessions: 10, earlySessions: 3 });
  });

  it('is zero without sessions', () => {
    expect(countSessions([])).toEqual({ sessions: 0, earlySessions: 0 });
  });
});
