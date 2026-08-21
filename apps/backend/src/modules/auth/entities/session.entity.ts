import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Uma linha por dispositivo logado (ADR-009). Nunca armazena o refresh
 * token em texto puro — só o hash, para permitir revogação sem expor segredo.
 */
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'refresh_token_hash' })
  refreshTokenHash: string;

  @Column({ name: 'device_label', nullable: true })
  deviceLabel?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'datetime' })
  lastUsedAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt?: Date | null;
}
