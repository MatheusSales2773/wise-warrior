import type Stripe from 'stripe';

/** Os tipos de evento do Stripe que o webhook processa (S2.2); os demais recebem `200` sem efeito. */
export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

type Expandable = string | { id: string } | null | undefined;

const idOf = (value: Expandable): string | null => (typeof value === 'string' ? value : value?.id ?? null);

/** O que o webhook precisa de um evento verificado: de quem é (Customer) e qual Assinatura reler. */
export interface SubscriptionEventTarget {
  customerId: string;
  subscriptionId: string | null;
  /** O `client_reference_id` de um Checkout de assinatura: o usuário que abriu a sessão (S3.6). */
  userId?: string;
}

/**
 * Customer e Assinatura de um evento de assinatura. `null` para o que não é de assinatura: o `checkout.session.completed`
 * de pagamento único (Pacote, S7) e uma fatura que não pertence a uma Assinatura.
 */
export function subscriptionEventTarget(event: Stripe.Event): SubscriptionEventTarget | null {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = idOf(event.data.object.customer);
      return customerId ? { customerId, subscriptionId: event.data.object.id } : null;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const customerId = idOf(event.data.object.customer);
      const subscriptionId = idOf(event.data.object.parent?.subscription_details?.subscription);
      return customerId && subscriptionId ? { customerId, subscriptionId } : null;
    }
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = idOf(session.customer);
      if (session.mode !== 'subscription' || !customerId) return null;
      const target: SubscriptionEventTarget = { customerId, subscriptionId: idOf(session.subscription) };
      if (session.client_reference_id) target.userId = session.client_reference_id;
      return target;
    }
    default:
      return null;
  }
}

/** O id da sessão de um Pacote pago (S7): o `checkout.session.completed` de pagamento único. `null` para o resto. */
export function packSessionId(event: Stripe.Event): string | null {
  return event.type === 'checkout.session.completed' && event.data.object.mode === 'payment' ? event.data.object.id : null;
}
