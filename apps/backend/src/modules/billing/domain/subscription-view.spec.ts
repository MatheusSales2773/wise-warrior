import { subscriptionView } from './subscription-view';

const PERIOD_END = new Date('2026-12-08T12:00:00.000Z');
const CANCEL_AT = new Date('2026-12-01T12:00:00.000Z');
const row = { status: 'active', currentPeriodEnd: PERIOD_END, cancelAt: null as Date | null };

describe('subscriptionView', () => {
  it('renews at the period end when nothing was cancelled', () => {
    expect(subscriptionView(true, 'premium', row)).toEqual({
      available: true, planTier: 'premium', status: 'active', renewsAt: PERIOD_END, premiumUntil: null,
    });
  });

  it('ends at cancel_at instead of renewing when the Subscription was cancelled', () => {
    expect(subscriptionView(true, 'premium', { ...row, cancelAt: CANCEL_AT })).toEqual({
      available: true, planTier: 'premium', status: 'active', renewsAt: null, premiumUntil: CANCEL_AT,
    });
  });

  it('passes the status of the row through untranslated', () => {
    expect(subscriptionView(true, 'premium', { ...row, status: 'past_due' }).status).toBe('past_due');
  });

  it('has no dates and no status for a user with no Subscription row', () => {
    expect(subscriptionView(true, 'free', null)).toEqual({
      available: true, planTier: 'free', status: null, renewsAt: null, premiumUntil: null,
    });
  });

  it('reports billing available only when Stripe is configured', () => {
    expect(subscriptionView(false, 'free', null).available).toBe(false);
    expect(subscriptionView(true, 'free', null).available).toBe(true);
  });
});
