import { QueryClient } from '@tanstack/react-query';
import {
  BREAK_SECONDS,
  breakRemainingSeconds,
  clearBreak,
  currentBreak,
  startBreak,
} from '@/features/study-session/pomodoro-break';

let queryClient: QueryClient;
beforeEach(() => { queryClient = new QueryClient(); });
afterEach(() => queryClient.clear());

it('uses 5 minutes for the short break and 15 for the long one', () => {
  expect(BREAK_SECONDS).toEqual({ short: 300, long: 900 });
});

it('starts a break whose deadline is its duration after the start', () => {
  const run = startBreak(queryClient, 'short', 1_000_000);

  expect(run).toEqual({ kind: 'short', durationSeconds: 300, deadlineMs: 1_300_000 });
  expect(currentBreak(queryClient)).toEqual(run);
});

it('counts down to the second from the local deadline and never goes below zero', () => {
  const run = startBreak(queryClient, 'long', 0);

  expect(breakRemainingSeconds(run, 0)).toBe(900);
  expect(breakRemainingSeconds(run, 1)).toBe(900);
  expect(breakRemainingSeconds(run, 1_000)).toBe(899);
  expect(breakRemainingSeconds(run, 899_001)).toBe(1);
  expect(breakRemainingSeconds(run, 900_000)).toBe(0);
  expect(breakRemainingSeconds(run, 5_000_000)).toBe(0);
});

it('forgets the break once cleared', () => {
  startBreak(queryClient, 'short', 0);
  clearBreak(queryClient);

  expect(currentBreak(queryClient)).toBeNull();
});

it('does not carry a break over to the next user: logout clears the whole cache', () => {
  startBreak(queryClient, 'long', 0);

  queryClient.clear();

  expect(currentBreak(queryClient)).toBeNull();
});

it('keeps the break past the default garbage collection time', () => {
  jest.useFakeTimers();
  try {
    startBreak(queryClient, 'long', 0);
    jest.advanceTimersByTime(10 * 60_000);

    expect(currentBreak(queryClient)).not.toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('keeps the focus that earned the break, so the break card survives leaving the Forja', () => {
  const previous = { subject: 'Cálculo II', validSeconds: 1500, xpAwarded: 250, completedInCycle: 3 };

  const run = startBreak(queryClient, 'short', 0, previous);

  expect(run.previous).toEqual(previous);
  expect(currentBreak(queryClient)?.previous).toEqual(previous);
});
