import { QueryClient } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';
import { applyPlanChanged } from '@/core/realtime/realtime-client';
import { dashboardKeys } from '@/features/dashboard/queries';
import { billingErrorMessage, billingKeys, openStripePage } from '@/features/settings/billing';
import { planLabel } from '@/features/settings/plan';
import { resetViewport, setViewport } from '../test-utils/viewport';

afterEach(async () => {
  jest.restoreAllMocks();
  await resetViewport();
});

describe('openStripePage (S5.4)', () => {
  it('leaves for Stripe in the same tab on the Web', async () => {
    await setViewport('web', 1440);
    const assign = jest.fn();
    const location = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } });
    try {
      await openStripePage('https://checkout.stripe.test/s');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: location });
    }
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s');
  });

  it('hands the page to the system browser on the native app', async () => {
    await setViewport('ios', 390);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openStripePage('https://checkout.stripe.test/s');
    expect(open).toHaveBeenCalledWith('https://checkout.stripe.test/s');
    expect(Platform.OS).toBe('ios');
  });
});

describe('billingErrorMessage (S5.11)', () => {
  const axiosError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

  it.each([409, 502, 503])('uses the server detail on %i', (status) => {
    expect(billingErrorMessage(axiosError(status, { detail: 'Assinatura indisponível no momento' }))).toBe('Assinatura indisponível no momento');
  });

  it('falls back to a generic line for other failures', () => {
    expect(billingErrorMessage(axiosError(500, { detail: 'stack trace' }))).toBe('Não foi possível abrir o pagamento. Tente de novo.');
    expect(billingErrorMessage(new Error('offline'))).toBe('Não foi possível abrir o pagamento. Tente de novo.');
  });
});

it('S5.2, S5.13: labels the plan with "premium em breve" only while billing is off', () => {
  expect(planLabel('free')).toBe('Free · premium em breve');
  expect(planLabel('free', true)).toBe('Free');
  expect(planLabel('premium', true)).toBe('Premium');
});

it('S5.12: user:planChanged refetches the subscription and the profile', () => {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  applyPlanChanged(client);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: billingKeys.subscription() });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardKeys.profile() });
});
