import { planTierForStatus } from './plan-tier';

describe('planTierForStatus', () => {
  it.each([
    ['active', 'premium'],
    ['trialing', 'premium'],
    ['past_due', 'premium'],
    ['canceled', 'free'],
    ['unpaid', 'free'],
    ['incomplete', 'free'],
    ['incomplete_expired', 'free'],
    ['paused', 'free'],
  ])('maps the Stripe status %s to %s', (status, planTier) => {
    expect(planTierForStatus(status)).toBe(planTier);
  });

  it('gives free to a user with no Subscription', () => {
    expect(planTierForStatus(null)).toBe('free');
  });

  it('gives free to a status Stripe adds later', () => {
    expect(planTierForStatus('some_future_status')).toBe('free');
  });
});
