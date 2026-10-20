import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { COIN_ORIGIN_TYPES, type CoinOriginType } from '../domain/coin-origin';

/** Uma linha do Extrato: um crédito ou débito de Moedas, com a origem (ADR-012). */
@Entity('coin_ledger_entries')
@Unique('UQ_coin_ledger_entries_user_id_origin_type_origin_ref', ['userId', 'originType', 'originRef'])
@Index('IDX_coin_ledger_entries_user_id_created_at_id', ['userId', 'createdAt', 'id'])
export class CoinLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_coin_ledger_entries_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  /** Positivo para crédito, negativo para débito. */
  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'balance_after', type: 'int', unsigned: true })
  balanceAfter: number;

  @Column({ name: 'origin_type', type: 'enum', enum: [...COIN_ORIGIN_TYPES] })
  originType: CoinOriginType;

  @Column({ name: 'origin_ref', type: 'varchar', length: 64 })
  originRef: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
