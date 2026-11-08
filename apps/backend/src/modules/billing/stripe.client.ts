import type Stripe from 'stripe';

/** Token do cliente do Stripe; `null` quando `STRIPE_SECRET_KEY` não está definido (cobrança indisponível). */
export const STRIPE_API = Symbol('STRIPE_API');

/** A versão da API do Stripe que o código foi escrito para ler (ADR-015); fixa, para o Stripe não mudar o formato por baixo. */
export const STRIPE_API_VERSION = '2026-10-28.endive';

/**
 * O pedaço do SDK do Stripe que o `BillingService` usa. Os testes trocam este contrato por um falso, mantendo a
 * verificação de assinatura do SDK real: nenhum teste chama a rede.
 */
export interface StripeApi {
  webhooks: {
    constructEvent(payload: string | Buffer, header: string, secret: string): Stripe.Event;
  };
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
    /** Cancela na hora (status `canceled`) e dispara `customer.subscription.deleted`; só a rota de desenvolvedor usa. */
    cancel(id: string): Promise<Stripe.Subscription>;
  };
  customers: {
    create(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer>;
  };
  billingPortal: {
    sessions: {
      create(params: Stripe.BillingPortal.SessionCreateParams): Promise<Stripe.BillingPortal.Session>;
    };
  };
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
      retrieve(id: string): Promise<Stripe.Checkout.Session>;
    };
  };
}
