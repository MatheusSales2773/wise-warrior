import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pack } from './pack.entity';

/** O Pagamento de um Pacote por um usuário (ADR-015): no máximo um por usuário e Pacote, e um por sessão do Checkout. */
@Entity('pack_payments')
@Unique('UQ_pack_payments_stripe_checkout_session_id', ['stripeCheckoutSessionId'])
@Unique('UQ_pack_payments_user_id_pack_id', ['userId', 'packId'])
export class PackPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_pack_payments_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => Pack)
  @JoinColumn({ name: 'pack_id', foreignKeyConstraintName: 'FK_pack_payments_pack_id_packs' })
  pack: Pack;

  @Column({ name: 'pack_id', type: 'varchar', length: 36 })
  packId: string;

  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', length: 255 })
  stripeCheckoutSessionId: string;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'paid_at', type: 'datetime' })
  paidAt: Date;
}
