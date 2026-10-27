import {
  isSaoPauloDayKey,
  saoPauloDayKey,
  saoPauloDayStart,
  saoPauloHour,
  saoPauloNextDayKey,
  saoPauloPreviousDayKey,
  saoPauloWeekAt,
} from './sao-paulo-calendar';

describe('São Paulo calendar', () => {
  describe('saoPauloHour', () => {
    it('reads the São Paulo wall-clock hour, not the UTC one', () => {
      expect(saoPauloHour(new Date('2026-09-18T09:59:59Z'))).toBe(6);
      expect(saoPauloHour(new Date('2026-09-18T10:00:00Z'))).toBe(7);
      expect(saoPauloHour(new Date('2026-09-18T02:30:00Z'))).toBe(23);
    });
  });

  describe('saoPauloDayKey', () => {
    it('puts 23:00 in São Paulo (02:00 UTC of the next day) on the São Paulo day', () => {
      expect(saoPauloDayKey(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17');
    });

    it('switches day exactly at São Paulo midnight (03:00 UTC)', () => {
      expect(saoPauloDayKey(new Date('2026-09-18T02:59:59.999Z'))).toBe('2026-09-17');
      expect(saoPauloDayKey(new Date('2026-09-18T03:00:00.000Z'))).toBe('2026-09-18');
    });

    it('keeps early UTC morning on the previous São Paulo day', () => {
      expect(saoPauloDayKey(new Date('2026-01-01T00:30:00Z'))).toBe('2025-12-31');
    });
  });

  describe('saoPauloDayStart', () => {
    it('is the instant São Paulo midnight begins', () => {
      expect(saoPauloDayStart('2026-09-18').toISOString()).toBe('2026-09-18T03:00:00.000Z');
    });

    it('round-trips with saoPauloDayKey', () => {
      const start = saoPauloDayStart('2026-09-18');
      expect(saoPauloDayKey(start)).toBe('2026-09-18');
      expect(saoPauloDayKey(new Date(start.getTime() - 1))).toBe('2026-09-17');
    });
  });

  describe('isSaoPauloDayKey', () => {
    it('accepts real days and rejects malformed or impossible ones', () => {
      expect(isSaoPauloDayKey('2026-09-17')).toBe(true);
      expect(isSaoPauloDayKey('2028-02-29')).toBe(true);
      expect(isSaoPauloDayKey('2026-02-30')).toBe(false);
      expect(isSaoPauloDayKey('01/09/2026')).toBe(false);
    });
  });

  describe('day key arithmetic', () => {
    it('moves across month and year edges', () => {
      expect(saoPauloNextDayKey('2026-12-31')).toBe('2027-01-01');
      expect(saoPauloPreviousDayKey('2026-03-01')).toBe('2026-02-28');
      expect(saoPauloPreviousDayKey('2026-09-17', 55)).toBe('2026-07-24');
    });
  });

  describe('saoPauloWeekAt', () => {
    it('runs Monday 00:00 to Sunday 23:59:59 in São Paulo', () => {
      const week = saoPauloWeekAt(new Date('2026-09-16T15:00:00Z')); // Wednesday
      expect(week.startsAt.toISOString()).toBe('2026-09-14T03:00:00.000Z');
      expect(week.endsAt.toISOString()).toBe('2026-09-21T02:59:59.000Z');
    });

    it('keeps Sunday 23:00 in São Paulo (Monday 02:00 UTC) in the week that is ending', () => {
      const week = saoPauloWeekAt(new Date('2026-09-21T02:00:00Z'));
      expect(week.startsAt.toISOString()).toBe('2026-09-14T03:00:00.000Z');
    });

    it('starts the next week exactly at Monday 00:00 in São Paulo', () => {
      const before = saoPauloWeekAt(new Date('2026-09-21T02:59:59Z'));
      const after = saoPauloWeekAt(new Date('2026-09-21T03:00:00Z'));
      expect(after.startsAt.toISOString()).toBe('2026-09-21T03:00:00.000Z');
      expect(after.number).toBe(before.number + 1);
    });
  });
});
