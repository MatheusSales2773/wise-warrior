import {
  BREAK_SECONDS,
  breakRemainingSeconds,
  clearBreak,
  currentBreak,
  startBreak,
} from '@/features/study-session/pomodoro-break';

afterEach(() => clearBreak());

it('uses 5 minutes for the short break and 15 for the long one', () => {
  expect(BREAK_SECONDS).toEqual({ short: 300, long: 900 });
});

it('starts a break whose deadline is its duration after the start', () => {
  const run = startBreak('short', 1_000_000);

  expect(run).toEqual({ kind: 'short', durationSeconds: 300, deadlineMs: 1_300_000 });
  expect(currentBreak()).toBe(run);
});

it('counts down to the second from the local deadline and never goes below zero', () => {
  const run = startBreak('long', 0);

  expect(breakRemainingSeconds(run, 0)).toBe(900);
  expect(breakRemainingSeconds(run, 1)).toBe(900);
  expect(breakRemainingSeconds(run, 1_000)).toBe(899);
  expect(breakRemainingSeconds(run, 899_001)).toBe(1);
  expect(breakRemainingSeconds(run, 900_000)).toBe(0);
  expect(breakRemainingSeconds(run, 5_000_000)).toBe(0);
});

it('forgets the break once cleared', () => {
  startBreak('short', 0);
  clearBreak();

  expect(currentBreak()).toBeNull();
});
