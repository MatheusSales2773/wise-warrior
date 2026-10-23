import { milestoneProgress } from './milestone';

const counts = { sessions: 87, earlySessions: 3 };

describe('milestoneProgress', () => {
  it('counts sessions toward a session-count Badge', () => {
    expect(milestoneProgress({ type: 'sessions', count: 100 }, counts, false)).toEqual({ progress: 87, target: 100 });
  });

  it('counts early sessions toward Madrugador', () => {
    expect(milestoneProgress({ type: 'early-sessions', count: 5 }, counts, false)).toEqual({ progress: 3, target: 5 });
  });

  it('caps progress at the target', () => {
    expect(milestoneProgress({ type: 'sessions', count: 50 }, counts, false)).toEqual({ progress: 50, target: 50 });
  });

  it('shows a Badge already in the Inventory as complete, whatever the counts say', () => {
    expect(milestoneProgress({ type: 'early-sessions', count: 5 }, { sessions: 0, earlySessions: 0 }, true)).toEqual({ progress: 5, target: 5 });
  });

  it('shows a Raid Badge as 0 of 1 until it is in the Inventory, then 1 of 1', () => {
    expect(milestoneProgress({ type: 'raid', slug: 'cerco-ao-grimorio' }, counts, false)).toEqual({ progress: 0, target: 1 });
    expect(milestoneProgress({ type: 'raid', slug: 'cerco-ao-grimorio' }, counts, true)).toEqual({ progress: 1, target: 1 });
  });

  it.each([{ type: 'level', level: 3 }, { type: 'purchase' }] as const)('has no progress for the %p condition', (condition) => {
    expect(milestoneProgress(condition, counts, false)).toBeNull();
  });
});
