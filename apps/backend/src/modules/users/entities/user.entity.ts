import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Character } from '../../progression/entities/character.entity';

export type PlanTier = 'free' | 'premium';

@Entity('users')
@Unique('UQ_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  /** Hash Argon2id — nunca a senha em texto puro (ADR de segurança, PRD seção 13). */
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'display_name' })
  displayName: string;

  /** Flag de entitlement (ADR-007) — sem gateway de pagamento nesta fase. */
  @Column({ name: 'plan_tier', type: 'varchar', default: 'free' })
  planTier: PlanTier;

  @OneToOne(() => Character, (character) => character.user)
  character?: Character;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
