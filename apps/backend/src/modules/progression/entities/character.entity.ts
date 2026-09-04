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
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_characters_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @Column({ default: 1 })
  level: number;

  @Column({ name: 'xp_total', type: 'bigint', default: 0 })
  xpTotal: number;

  @Column({ nullable: true })
  title?: string;

  /**
   * "Companheiro" (mascote RPG) fica fora do escopo da Fase 1 — ADR-004.
   * A coluna permanece reservada, sem uma tabela Companion nesta migration.
   */
  @Column({ name: 'companion_id', type: 'varchar', length: '36', nullable: true })
  companionId?: string | null;
}
