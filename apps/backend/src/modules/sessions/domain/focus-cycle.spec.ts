import { focusCycle } from './focus-cycle';

describe('focusCycle', () => {
  it.each([
    [0, 0, 'short'],
    [1, 1, 'short'],
    [3, 3, 'short'],
    [4, 4, 'long'],
    [5, 1, 'short'],
    [7, 3, 'short'],
    [8, 4, 'long'],
  ])('with %i completed focuses the cycle holds %i and the next break is %s', (completed, inCycle, nextBreak) => {
    expect(focusCycle(completed)).toEqual({ completedInCycle: inCycle, cycleLength: 4, nextBreak });
  });
});
