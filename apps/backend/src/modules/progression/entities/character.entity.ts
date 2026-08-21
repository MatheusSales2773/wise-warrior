import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ default: 1 })
  level: number;

  @Column({ name: 'xp_total', type: 'bigint', default: 0 })
  xpTotal: number;

  @Column({ nullable: true })
  title?: string;

  /**
   * "Companheiro" (mascote RPG) fica fora do escopo da Fase 1 — ADR-004.
   * Coluna reservada para não exigir migração quando a feature for priorizada.
   */
  @Column({ name: 'companion_id', type: 'uuid', nullable: true })
  companionId?: string | null;
}
