import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Raid } from '../../raids/entities/raid.entity';

export type StudySessionMode = 'solo' | 'guild';

@Entity('study_sessions')
@Index('IDX_study_sessions_user_id_started_at', ['userId', 'startedAt'])
@Index('IDX_study_sessions_raid_id', ['raidId'])
export class StudySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_study_sessions_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @Column()
  subject: string;

  @Column({ type: 'varchar' })
  mode: StudySessionMode;

  /** Preenchido quando mode = 'guild' — raid que recebe a contribuição desta sessão. */
  @ManyToOne(() => Raid, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'raid_id', foreignKeyConstraintName: 'FK_study_sessions_raid_id_raids' })
  raid?: Raid | null;

  @Column({ name: 'raid_id', type: 'varchar', length: '36', nullable: true })
  raidId?: string | null;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date | null;

  @Column({ name: 'last_heartbeat_at', type: 'datetime', nullable: true })
  lastHeartbeatAt?: Date | null;

  /** Duração já validada pelo antifraude (RN-ANTIFRAUDE) — fonte de verdade pra XP. */
  @Column({ name: 'duration_valid_seconds', default: 0 })
  durationValidSeconds: number;

  @Column({ name: 'xp_awarded', default: 0 })
  xpAwarded: number;

  /** Preenchido quando a sessão é descartada por antifraude — nunca some silenciosamente. */
  @Column({ name: 'discarded_reason', type: 'varchar', nullable: true })
  discardedReason?: string | null;
}
