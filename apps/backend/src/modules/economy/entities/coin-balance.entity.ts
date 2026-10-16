import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Saldo de Moedas de um usuário (ADR-012). Sem linha, o saldo é zero. */
@Entity('coin_balances')
export class CoinBalance {
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_coin_balances_user_id_users' })
  user: User;

  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  balance: number;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
