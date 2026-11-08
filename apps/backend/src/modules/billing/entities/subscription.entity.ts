import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** A Assinatura premium de um usuário no Stripe (ADR-015). No máximo uma por usuário; só o `BillingModule` a lê e grava. */
@Entity('subscriptions')
@Unique('UQ_subscriptions_user_id', ['userId'])
@Unique('UQ_subscriptions_stripe_customer_id', ['stripeCustomerId'])
@Unique('UQ_subscriptions_stripe_subscription_id', ['stripeSubscriptionId'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_subscriptions_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 255 })
  stripeCustomerId: string;

  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  /** Status do Stripe, sem tradução. `null` antes da primeira sincronização. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  status: string | null;

  @Column({ name: 'current_period_end', type: 'datetime', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'cancel_at', type: 'datetime', nullable: true })
  cancelAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
