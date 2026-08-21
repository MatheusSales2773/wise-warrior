import {
  MAX_CONTINUOUS_SESSION_SECONDS,
  MAX_DAILY_SECONDS,
  validateSessionDuration,
} from './session-validator';

const START = new Date('2026-08-21T10:00:00Z');

function endAfter(seconds: number): Date {
  return new Date(START.getTime() + seconds * 1000);
}

describe('validateSessionDuration', () => {
  it('accepts a normal 25-minute Pomodoro session', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(25 * 60),
      priorDailySeconds: 0,
    });
    expect(result.discardedReason).toBeNull();
    expect(result.validSeconds).toBe(25 * 60);
  });

  it('accepts a session exactly at the continuous limit', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(MAX_CONTINUOUS_SESSION_SECONDS),
      priorDailySeconds: 0,
    });
    expect(result.discardedReason).toBeNull();
  });

  it('discards a session that exceeds the continuous limit', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(MAX_CONTINUOUS_SESSION_SECONDS + 1),
      priorDailySeconds: 0,
    });
    expect(result.discardedReason).toBe('continuous-session-exceeds-limit');
    expect(result.validSeconds).toBe(0);
  });

  it('discards a short session that pushes the daily sum over the limit', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(30 * 60),
      priorDailySeconds: MAX_DAILY_SECONDS - 60,
    });
    expect(result.discardedReason).toBe('daily-limit-exceeded');
    expect(result.validSeconds).toBe(0);
  });

  it('accepts a session that lands exactly at the daily limit', () => {
    const result = validateSessionDuration({
      startedAt: START,
      endedAt: endAfter(60),
      priorDailySeconds: MAX_DAILY_SECONDS - 60,
    });
    expect(result.discardedReason).toBeNull();
  });

  it('throws when endedAt is not after startedAt', () => {
    expect(() =>
      validateSessionDuration({
        startedAt: START,
        endedAt: START,
        priorDailySeconds: 0,
      }),
    ).toThrow();
  });

  it('throws for negative priorDailySeconds', () => {
    expect(() =>
      validateSessionDuration({
        startedAt: START,
        endedAt: endAfter(60),
        priorDailySeconds: -1,
      }),
    ).toThrow();
  });
});
