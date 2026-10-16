import { validateSessionDuration, validateStudySessionFocusSeconds } from './session-validator';

const START = new Date('2026-08-21T10:00:00Z');
const FOUR_HOURS = 4 * 3600;
const SIXTEEN_HOURS = 16 * 3600;

function endAfter(seconds: number): Date {
  return new Date(START.getTime() + seconds * 1000);
}

describe('validateSessionDuration', () => {
  afterEach(() => {
    delete process.env.ANTIFRAUDE_MAX_CONTINUOUS_HOURS;
    delete process.env.ANTIFRAUDE_MAX_DAILY_HOURS;
  });

  it('accepts a normal 25-minute session untouched', () => {
    const result = validateSessionDuration({ startedAt: START, endedAt: endAfter(25 * 60), priorDailySeconds: 0 });
    expect(result).toEqual({ durationSeconds: 1500, validSeconds: 1500, cappedReason: null });
  });

  it('accepts a session exactly at the continuous limit', () => {
    const result = validateSessionDuration({ startedAt: START, endedAt: endAfter(FOUR_HOURS), priorDailySeconds: 0 });
    expect(result.validSeconds).toBe(FOUR_HOURS);
    expect(result.cappedReason).toBeNull();
  });

  it('truncates a session over the continuous limit instead of discarding it', () => {
    const result = validateSessionDuration({ startedAt: START, endedAt: endAfter(5 * 3600), priorDailySeconds: 0 });
    expect(result).toEqual({ durationSeconds: 5 * 3600, validSeconds: FOUR_HOURS, cappedReason: 'continuous-limit' });
  });

  it('truncates to the remaining daily balance', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(3 * 3600),
      priorDailySeconds: 14 * 3600,
    });
    expect(result.validSeconds).toBe(2 * 3600);
    expect(result.cappedReason).toBe('daily-limit');
  });

  it('accepts a session that lands exactly at the daily limit', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(60),
      priorDailySeconds: SIXTEEN_HOURS - 60,
    });
    expect(result.validSeconds).toBe(60);
    expect(result.cappedReason).toBeNull();
  });

  it('grants nothing when the daily balance is already spent', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(600),
      priorDailySeconds: SIXTEEN_HOURS,
    });
    expect(result.validSeconds).toBe(0);
    expect(result.cappedReason).toBe('daily-limit');
  });

  it('reads the limits from the environment', () => {
    process.env.ANTIFRAUDE_MAX_CONTINUOUS_HOURS = '1';
    const result = validateSessionDuration({ startedAt: START, endedAt: endAfter(2 * 3600), priorDailySeconds: 0 });
    expect(result.validSeconds).toBe(3600);
    expect(result.cappedReason).toBe('continuous-limit');
  });

  it('throws when endedAt is not after startedAt', () => {
    expect(() => validateSessionDuration({ startedAt: START, endedAt: START, priorDailySeconds: 0 })).toThrow();
  });

  it('throws for negative priorDailySeconds', () => {
    expect(() => validateSessionDuration({ startedAt: START, endedAt: endAfter(60), priorDailySeconds: -1 })).toThrow();
  });
});

describe('validateStudySessionFocusSeconds', () => {
  it('validates focus seconds directly without wall-clock timestamps', () => {
    expect(validateStudySessionFocusSeconds(900, 0)).toEqual({
      durationSeconds: 900,
      validSeconds: 900,
      cappedReason: null,
    });
  });

  it('prefers the daily reason when both limits bind', () => {
    expect(validateStudySessionFocusSeconds(FOUR_HOURS + 1, SIXTEEN_HOURS - 60)).toMatchObject({
      validSeconds: 60,
      cappedReason: 'daily-limit',
    });
  });
});
