import type Stripe from 'stripe';
import { HANDLED_EVENT_TYPES, isHandledEventType, packSessionId, subscriptionEventTarget } from './webhook-event';

const event = (type: string, object: Record<string, unknown>) => ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event;

describe('isHandledEventType', () => {
  it.each(HANDLED_EVENT_TYPES)('handles %s', (type) => {
    expect(isHandledEventType(type)).toBe(true);
  });

  it.each(['customer.subscription.trial_will_end', 'invoice.created', 'payment_intent.succeeded', 'customer.created'])(
    'ignores %s',
    (type) => {
      expect(isHandledEventType(type)).toBe(false);
    },
  );

  it('lists exactly the 6 types of S2.2', () => {
    expect([...HANDLED_EVENT_TYPES].sort()).toEqual([
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.deleted',
      'customer.subscription.updated',
      'invoice.paid',
      'invoice.payment_failed',
    ]);
  });
});

describe('subscriptionEventTarget', () => {
  it.each(['created', 'updated', 'deleted'])('reads the Customer and the Subscription of customer.subscription.%s', (suffix) => {
    expect(subscriptionEventTarget(event(`customer.subscription.${suffix}`, { id: 'sub_1', customer: 'cus_1' })))
      .toEqual({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it.each(['invoice.paid', 'invoice.payment_failed'])('reads the Subscription of %s from the invoice parent', (type) => {
    expect(subscriptionEventTarget(event(type, {
      customer: 'cus_1',
      parent: { subscription_details: { subscription: 'sub_1' } },
    }))).toEqual({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it('accepts an expanded Customer and an expanded Subscription', () => {
    expect(subscriptionEventTarget(event('invoice.paid', {
      customer: { id: 'cus_1' },
      parent: { subscription_details: { subscription: { id: 'sub_1' } } },
    }))).toEqual({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it('has no target for an invoice that does not belong to a Subscription', () => {
    expect(subscriptionEventTarget(event('invoice.paid', { customer: 'cus_1', parent: null }))).toBeNull();
  });

  it('reads the Customer and the Subscription of a subscription Checkout Session', () => {
    expect(subscriptionEventTarget(event('checkout.session.completed', { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1' })))
      .toEqual({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it('carries the client_reference_id of a subscription Checkout Session as the user', () => {
    expect(subscriptionEventTarget(event('checkout.session.completed', {
      mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', client_reference_id: 'user-1',
    }))).toStrictEqual({ customerId: 'cus_1', subscriptionId: 'sub_1', userId: 'user-1' });
  });

  it('has no Subscription to read for a subscription Checkout Session that carries none', () => {
    expect(subscriptionEventTarget(event('checkout.session.completed', { mode: 'subscription', customer: 'cus_1', subscription: null })))
      .toEqual({ customerId: 'cus_1', subscriptionId: null });
  });

  it('has no target for a one-time payment Checkout Session (Pacote)', () => {
    expect(subscriptionEventTarget(event('checkout.session.completed', { mode: 'payment', customer: 'cus_1' }))).toBeNull();
  });

  it('has no target when the event carries no Customer', () => {
    expect(subscriptionEventTarget(event('customer.subscription.updated', { id: 'sub_1', customer: null }))).toBeNull();
  });
});

describe('packSessionId', () => {
  it('reads the session id of a completed one-time payment Checkout (Pacote)', () => {
    expect(packSessionId(event('checkout.session.completed', { id: 'cs_1', mode: 'payment' }))).toBe('cs_1');
  });

  it('has no Pacote session for a subscription Checkout or any other event type', () => {
    expect(packSessionId(event('checkout.session.completed', { id: 'cs_1', mode: 'subscription' }))).toBeNull();
    expect(packSessionId(event('invoice.paid', { id: 'in_1', mode: 'payment' }))).toBeNull();
  });
});
