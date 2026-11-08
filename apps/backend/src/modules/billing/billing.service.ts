import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type Stripe from 'stripe';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService, type PackItem } from '../users/users.service';
import { planTierForStatus } from './domain/plan-tier';
import { visiblePacks } from './domain/packs';
import { subscriptionView, type SubscriptionView } from './domain/subscription-view';
import { isHandledEventType, packSessionId, subscriptionEventTarget } from './domain/webhook-event';
import { Pack } from './entities/pack.entity';
import { PackPayment } from './entities/pack-payment.entity';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

/** Um Pacote como a Loja o mostra: preço em centavos, os itens dele e se o usuário já o pagou. */
export interface PackView {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  items: PackItem[];
  owned: boolean;
}

export interface PackList {
  available: boolean;
  packs: PackView[];
}

const fromUnixSeconds = (seconds: number | null | undefined): Date | null =>
  typeof seconds === 'number' ? new Date(seconds * 1000) : null;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Pack) private readonly packs: Repository<Pack>,
    @InjectRepository(PackPayment) private readonly packPayments: Repository<PackPayment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(STRIPE_API) private readonly stripe: StripeApi | null,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Os Pacotes da Loja para o usuário (S6): os À venda e os fora de venda que ele pagou, por nome. Sem cobrança
   * configurada, nenhum, para a Loja esconder a seção.
   */
  async listPacks(userId: string): Promise<PackList> {
    if (!this.stripe) return { available: false, packs: [] };
    const [packs, payments] = await Promise.all([this.packs.find(), this.packPayments.find({ where: { userId } })]);
    const shown = visiblePacks(packs, new Set(payments.map((payment) => payment.packId)));
    const items = await this.users.listPackItems(shown.map((pack) => pack.slug));
    return {
      available: true,
      packs: shown.map((pack) => ({
        slug: pack.slug,
        name: pack.name,
        description: pack.description,
        priceCents: pack.priceCents,
        currency: pack.currency,
        items: items.get(pack.slug) ?? [],
        owned: pack.owned,
      })),
    };
  }

  /**
   * Webhook do Stripe (ADR-015). Verifica a assinatura sobre o corpo bruto antes de ler ou gravar qualquer coisa (400);
   * tipos de evento fora da lista e Customers sem Assinatura recebem 200 sem efeito. Para o resto, relê a Assinatura
   * na API do Stripe, grava o que ela devolveu (nunca o payload) e deriva o `plan_tier`. Reler faz o resultado não
   * depender da ordem nem da repetição dos eventos. Se a API falhar, 500 sem gravar, para o Stripe reenviar.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const event = this.verify(rawBody, signature);
    if (!isHandledEventType(event.type)) return;

    const packSession = packSessionId(event);
    if (packSession) return this.grantPack(event.id, packSession);

    const target = subscriptionEventTarget(event);
    if (!target) return;
    // Um Checkout traz o usuário no `client_reference_id`: a linha precisa ser dele e do Customer do evento (S3.6).
    const row = await this.subscriptions.findOne({
      where: { stripeCustomerId: target.customerId, ...(target.userId && { userId: target.userId }) },
    });
    if (!row) {
      this.logger.warn(`Evento ${event.id} ignorado: o Customer ${target.customerId} não tem Assinatura${target.userId ? ` do usuário ${target.userId}` : ''}`);
      return;
    }
    const { subscriptionId } = target;
    if (!subscriptionId) return;

    const outcome = await this.dataSource.transaction((manager) => this.sync(manager, row.userId, event.id, subscriptionId));
    if (!outcome) return;

    // Depois do commit: um rollback não deixa evento nenhum para trás.
    if (outcome.planChanged) this.realtime.emitToUser(outcome.userId, 'user:planChanged', { planTier: outcome.planTier });
    this.users.publishEquipmentChanges(outcome.userId, outcome.equipment);
  }

  /**
   * Abre o Checkout do premium (S3). Trava o usuário antes de ler a linha, então chamadas simultâneas criam um só
   * Customer. A linha nova só é gravada se o Customer e a sessão deram certo: uma falha do Stripe desfaz a transação.
   */
  async openCheckout(userId: string): Promise<{ url: string }> {
    const stripe = this.stripe;
    if (!stripe) throw new ServiceUnavailableException('Assinatura indisponível no momento');

    return this.dataSource.transaction(async (manager) => {
      const planTier = await this.users.lockPlanTier(manager, userId);
      // Token válido de um usuário que não existe mais: a Surface só prevê 401 para quem não é um usuário.
      if (!planTier) throw new UnauthorizedException();
      if (planTier === 'premium') throw new ConflictException('Você já tem o plano premium');

      const returnUrl = `${this.config.get<string>('APP_URL')}/configuracao/plano`;
      return this.openSession(manager, stripe, userId, {
        mode: 'subscription',
        line_items: [{ price: this.config.get<string>('STRIPE_PRICE_PREMIUM'), quantity: 1 }],
        success_url: `${returnUrl}?checkout=success`,
        cancel_url: `${returnUrl}?checkout=cancel`,
      });
    });
  }

  /**
   * Abre o Checkout de um Pacote (S7), em pagamento único com o preço de `packs`. Trava o usuário, então a checagem
   * "já pagou" e a criação do Customer não correm contra outra chamada dele. 404 para slug inexistente ou fora de
   * venda; 409 para quem já pagou (mesmo se o Pacote saiu de venda depois).
   */
  async openPackCheckout(userId: string, slug: string): Promise<{ url: string }> {
    const stripe = this.stripe;
    if (!stripe) throw new ServiceUnavailableException('Pagamento indisponível no momento');

    return this.dataSource.transaction(async (manager) => {
      if (!(await this.users.lockForUpdate(userId, manager))) throw new UnauthorizedException();
      const pack = await manager.getRepository(Pack).findOne({ where: { slug } });
      if (!pack) throw new NotFoundException('Pacote não encontrado');
      if (await manager.getRepository(PackPayment).exists({ where: { userId, packId: pack.id } })) {
        throw new ConflictException('Você já tem este Pacote');
      }
      if (!pack.forSale) throw new NotFoundException('Pacote não encontrado');

      const returnUrl = `${this.config.get<string>('APP_URL')}/mercado?secao=pacotes`;
      return this.openSession(manager, stripe, userId, {
        mode: 'payment',
        // ADR-015: só cartão, que confirma na hora; um meio atrasado deixaria a sessão `unpaid` sem evento que a conceda.
        allowed_payment_method_types: ['card'],
        line_items: [{
          price_data: { currency: pack.currency, unit_amount: pack.priceCents, product_data: { name: pack.name } },
          quantity: 1,
        }],
        metadata: { packSlug: pack.slug },
        success_url: `${returnUrl}&checkout=success`,
        cancel_url: `${returnUrl}&checkout=cancel`,
      });
    });
  }

  /**
   * Reutiliza ou cria o Customer do usuário e abre a sessão do Checkout. A linha de `subscriptions` nova só é gravada
   * se o Customer e a sessão deram certo; o chamador já travou o usuário.
   */
  private async openSession(
    manager: EntityManager,
    stripe: StripeApi,
    userId: string,
    params: Omit<Stripe.Checkout.SessionCreateParams, 'customer' | 'client_reference_id'>,
  ): Promise<{ url: string }> {
    const rows = manager.getRepository(Subscription);
    const row = await rows.findOne({ where: { userId } });
    let customerId: string;
    let session: Stripe.Checkout.Session;
    try {
      customerId = row?.stripeCustomerId ?? (await stripe.customers.create({ metadata: { userId } })).id;
      session = await stripe.checkout.sessions.create({ ...params, customer: customerId, client_reference_id: userId });
    } catch (error) {
      this.logger.error(`Checkout do usuário ${userId}: o Stripe falhou: ${(error as Error).message}`);
      throw new BadGatewayException('Não foi possível abrir o pagamento');
    }
    if (!row) await rows.insert({ userId, stripeCustomerId: customerId });
    // O Checkout hospedado sempre devolve a URL.
    return { url: session.url! };
  }

  /**
   * Abre o Portal do cliente do Stripe (S4) para o Customer do próprio usuário. Só quem já tem Assinatura: um Customer
   * sem Assinatura (Checkout aberto, ou só Pacote) não tem o que gerenciar. Nada é gravado.
   */
  async openPortal(userId: string): Promise<{ url: string }> {
    if (!this.stripe) throw new ServiceUnavailableException('Assinatura indisponível no momento');

    const row = await this.subscriptions.findOne({ where: { userId } });
    if (!row?.stripeSubscriptionId) throw new ConflictException('Nenhuma assinatura para gerenciar');
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: row.stripeCustomerId,
        return_url: `${this.config.get<string>('APP_URL')}/configuracao/plano`,
      });
      return { url: session.url };
    } catch (error) {
      this.logger.error(`Portal do usuário ${userId}: o Stripe falhou: ${(error as Error).message}`);
      throw new BadGatewayException('Não foi possível abrir o pagamento');
    }
  }

  /**
   * Ferramenta de teste: cancela já a Assinatura no Stripe. Não grava nada: o plano volta a Free quando chega o
   * webhook `customer.subscription.deleted`. Quem não está em `DEV_TOOLS_EMAILS` recebe 404, antes de qualquer outra leitura.
   */
  async resetPlan(userId: string): Promise<void> {
    if (!(await this.users.isDevToolsUser(userId))) throw new NotFoundException();
    if (!this.stripe) throw new ServiceUnavailableException('Assinatura indisponível no momento');

    const row = await this.subscriptions.findOne({ where: { userId } });
    if (!row?.stripeSubscriptionId || planTierForStatus(row.status) !== 'premium') {
      throw new ConflictException('Nenhuma assinatura para cancelar');
    }
    try {
      await this.stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } catch (error) {
      this.logger.error(`Reset do plano do usuário ${userId}: o Stripe falhou: ${(error as Error).message}`);
      throw new BadGatewayException('Não foi possível cancelar a assinatura');
    }
  }

  /** O estado da Assinatura do usuário para a tela Plano (S5.1); lê só `subscriptions` e o `plan_tier` pelo `UsersService`. */
  async getSubscription(userId: string): Promise<SubscriptionView> {
    const planTier = await this.users.findPlanTier(userId);
    // Token válido de um usuário que não existe mais.
    if (!planTier) throw new UnauthorizedException();
    return subscriptionView(this.stripe !== null, planTier, await this.subscriptions.findOne({ where: { userId } }));
  }

  /**
   * Paga o Pacote (S7.5-S7.8): relê a sessão na API, não o payload, e só com `payment_status` pago grava o Pagamento e
   * dá os itens, na mesma transação. Trava o usuário, então entregas repetidas ou simultâneas veem o Pagamento do
   * primeiro e terminam sem efeito; só quem gravou emite `user:packGranted`, depois do commit.
   */
  private async grantPack(eventId: string, sessionId: string): Promise<void> {
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe!.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      this.logger.error(`Evento ${eventId}: falha ao reler a sessão ${sessionId} no Stripe: ${(error as Error).message}`);
      throw new InternalServerErrorException('Não foi possível reler a sessão no Stripe');
    }
    const userId = session.client_reference_id;
    const slug = session.metadata?.packSlug;
    if (session.mode !== 'payment' || session.payment_status !== 'paid') return;
    if (!userId || !slug) {
      this.logger.warn(`Evento ${eventId} ignorado: a sessão ${sessionId} não traz usuário e Pacote`);
      return;
    }

    const granted = await this.dataSource.transaction(async (manager) => {
      if (!(await this.users.lockForUpdate(userId, manager))) {
        this.logger.warn(`Evento ${eventId}: a sessão ${sessionId} foi paga por um usuário que não existe mais (${userId})`);
        return null;
      }
      const pack = await manager.getRepository(Pack).findOne({ where: { slug } });
      if (!pack) {
        this.logger.warn(`Evento ${eventId} ignorado: o Pacote ${slug} da sessão ${sessionId} não existe`);
        return null;
      }
      const payments = manager.getRepository(PackPayment);
      const existing = await payments.findOne({ where: { userId, packId: pack.id } });
      if (existing) {
        if (existing.stripeCheckoutSessionId !== sessionId) {
          this.logger.warn(`Evento ${eventId}: a sessão ${sessionId} pagou de novo o Pacote ${slug} do usuário ${userId}`);
        }
        return null;
      }
      await payments.insert({
        userId,
        packId: pack.id,
        stripeCheckoutSessionId: sessionId,
        amountCents: session.amount_total ?? pack.priceCents,
        currency: session.currency ?? pack.currency,
        paidAt: new Date(),
      });
      return { cosmeticItemIds: await this.users.grantPackItems(manager, userId, slug) };
    });
    if (granted) this.realtime.emitToUser(userId, 'user:packGranted', { slug, cosmeticItemIds: granted.cosmeticItemIds });
  }

  private verify(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !secret || !signature || !rawBody) {
      throw new BadRequestException('Assinatura do webhook inválida');
    }
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Assinatura do webhook inválida');
    }
  }

  private async readSubscription(eventId: string, subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe!.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      this.logger.error(`Evento ${eventId}: falha ao reler a Assinatura ${subscriptionId} no Stripe: ${(error as Error).message}`);
      throw new InternalServerErrorException('Não foi possível reler a assinatura no Stripe');
    }
  }

  /**
   * Relê a Assinatura e grava o que ela devolveu, com o plano que ela dá, numa só transação. `null`: o evento não
   * mexe em nada. Trava o usuário antes de ler qualquer coisa, inclusive a API do Stripe: eventos concorrentes se
   * serializam, e o último a gravar é o último a reler, então a ordem de chegada não deixa um estado velho por cima
   * de um novo. Também por isso a leitura consistente do MySQL (REPEATABLE READ), que nasce na primeira consulta,
   * já vê o plano que o evento anterior commitou e não emite de novo.
   */
  private async sync(manager: EntityManager, userId: string, eventId: string, subscriptionId: string) {
    if (!(await this.users.lockForUpdate(userId, manager))) return null;
    const subscription = await this.readSubscription(eventId, subscriptionId);
    const rows = manager.getRepository(Subscription);
    const row = await rows.findOne({ where: { userId } });
    if (!row) return null;

    const planTier = planTierForStatus(subscription.status);
    // Um evento atrasado de uma Assinatura antiga e já encerrada não derruba a que a pessoa assinou depois.
    if (row.stripeSubscriptionId && row.stripeSubscriptionId !== subscription.id && planTier === 'free') return null;

    await rows.update({ id: row.id }, {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: fromUnixSeconds(subscription.items.data[0]?.current_period_end),
      cancelAt: fromUnixSeconds(subscription.cancel_at),
    });
    const change = await this.users.applyPlanTier(manager, row.userId, planTier);
    return { userId: row.userId, planTier, planChanged: change.changed, equipment: change.equipment };
  }
}
