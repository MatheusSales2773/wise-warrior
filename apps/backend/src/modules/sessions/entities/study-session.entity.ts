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
export type StudySessionState = 'running' | 'paused' | 'completed' | 'stopped_early' | 'cancelled' | 'discarded';
export type StudySessionTerminalReason = 'manual-stop' | 'legacy-session-without-owner';

@Entity('study_sessions')
@Index('IDX_study_sessions_user_id_started_at', ['userId', 'startedAt'])
@Index('IDX_study_sessions_user_id_ended_at_id', ['userId', 'endedAt', 'id'])
@Index('IDX_study_sessions_raid_id', ['raidId'])
export class StudySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_study_sessions_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column({ type: 'varchar' })
  mode: StudySessionMode;

  /** Preenchido quando mode = 'guild' — raid que recebe a contribuição desta sessão. */
  @ManyToOne(() => Raid, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'raid_id', foreignKeyConstraintName: 'FK_study_sessions_raid_id_raids' })
  raid?: Raid | null;

  @Column({ name: 'raid_id', type: 'varchar', length: '36', nullable: true })
  raidId?: string | null;

  @CreateDateColumn({ name: 'started_at', type: 'datetime', precision: 6 })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date | null;

  @Column({ name: 'planned_duration_seconds', type: 'int', nullable: true })
  plannedDurationSeconds?: number | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  state?: StudySessionState | null;

  @Column({ name: 'run_deadline_at', type: 'datetime', precision: 3, nullable: true })
  runDeadlineAt?: Date | null;

  @Column({ name: 'paused_at', type: 'datetime', precision: 3, nullable: true })
  pausedAt?: Date | null;

  @Column({ name: 'paused_total_seconds', type: 'int', default: 0 })
  pausedTotalSeconds: number;

  @Column({ name: 'paused_total_milliseconds', type: 'bigint', unsigned: true, default: 0 })
  pausedTotalMilliseconds?: number | string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'terminal_reason', type: 'varchar', length: 120, nullable: true })
  terminalReason?: StudySessionTerminalReason | null;

  @Column({ name: 'initiating_session_id', type: 'varchar', length: 36, nullable: true })
  initiatingSessionId?: string | null;

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
