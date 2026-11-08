import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type Stripe from 'stripe';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { planTierForStatus } from './domain/plan-tier';
import { isHandledEventType, subscriptionEventTarget } from './domain/webhook-event';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, type StripeApi } from './stripe.client';

const fromUnixSeconds = (seconds: number | null | undefined): Date | null =>
  typeof seconds === 'number' ? new Date(seconds * 1000) : null;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(STRIPE_API) private readonly stripe: StripeApi | null,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Webhook do Stripe (ADR-015). Verifica a assinatura sobre o corpo bruto antes de ler ou gravar qualquer coisa (400);
   * tipos de evento fora da lista e Customers sem Assinatura recebem 200 sem efeito. Para o resto, relê a Assinatura
   * na API do Stripe, grava o que ela devolveu (nunca o payload) e deriva o `plan_tier`. Reler faz o resultado não
   * depender da ordem nem da repetição dos eventos. Se a API falhar, 500 sem gravar, para o Stripe reenviar.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const event = this.verify(rawBody, signature);
    if (!isHandledEventType(event.type)) return;

    const target = subscriptionEventTarget(event);
    if (!target) return;
    const row = await this.subscriptions.findOne({ where: { stripeCustomerId: target.customerId } });
    if (!row) {
      this.logger.warn(`Evento ${event.id} ignorado: o Customer ${target.customerId} não tem Assinatura`);
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
