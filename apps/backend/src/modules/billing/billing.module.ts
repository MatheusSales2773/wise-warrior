import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Pack } from './entities/pack.entity';
import { PackPayment } from './entities/pack-payment.entity';
import { Subscription } from './entities/subscription.entity';
import { STRIPE_API, STRIPE_API_VERSION, type StripeApi } from './stripe.client';

/** Cobrança com o Stripe (ADR-015). Só mexe em `plan_tier` e no Inventário pelo `UsersService` (ADR-001). */
@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Pack, PackPayment]), UsersModule, RealtimeModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: STRIPE_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StripeApi | null => {
        const key = config.get<string>('STRIPE_SECRET_KEY');
        return key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION }) : null;
      },
    },
  ],
})
export class BillingModule {}
