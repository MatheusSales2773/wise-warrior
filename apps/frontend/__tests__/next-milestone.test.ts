import type { Milestone } from '@/features/chronicles/api';
import { nextMilestone } from '@/features/chronicles/milestones';

const milestone = (id: string, progress: number, target: number, earned = false): Milestone => ({ id, name: id, progress, target, earned });

describe('nextMilestone', () => {
  it('picks the unearned Marco with the highest progress over target', () => {
    expect(nextMilestone([milestone('a', 70, 100), milestone('b', 4, 5), milestone('c', 0, 1)])?.id).toBe('b');
  });

  it('ignores earned Marcos, even though their progress equals the target', () => {
    expect(nextMilestone([milestone('a', 5, 5, true), milestone('b', 1, 100)])?.id).toBe('b');
  });

  it('breaks a tie by the server order', () => {
    expect(nextMilestone([milestone('a', 1, 2), milestone('b', 2, 4), milestone('c', 0, 1)])?.id).toBe('a');
  });

  it('breaks a tie between the leaders by the server order even after a lower candidate', () => {
    expect(nextMilestone([milestone('a', 1, 5), milestone('b', 3, 4), milestone('c', 6, 8)])?.id).toBe('b');
  });

  it('is undefined when every Marco is earned or there are none', () => {
    expect(nextMilestone([milestone('a', 5, 5, true)])).toBeUndefined();
    expect(nextMilestone([])).toBeUndefined();
  });
});
