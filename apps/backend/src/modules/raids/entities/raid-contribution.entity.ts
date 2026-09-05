import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Raid } from './raid.entity';
import { User } from '../../users/entities/user.entity';
import { StudySession } from '../../sessions/entities/study-session.entity';

/** Índice composto: acelera o GROUP BY userId da query de ranking (RaidsService.ranking). */
@Entity('raid_contributions')
@Index('IDX_raid_contributions_raid_id_user_id', ['raidId', 'userId'])
@Index('IDX_raid_contributions_user_id', ['userId'])
@Index('IDX_raid_contributions_study_session_id', ['studySessionId'])
export class RaidContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Raid, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raid_id', foreignKeyConstraintName: 'FK_raid_contributions_raid_id_raids' })
  raid: Raid;

  @Column({ name: 'raid_id', type: 'varchar', length: '36' })
  raidId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_raid_contributions_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @ManyToOne(() => StudySession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'study_session_id', foreignKeyConstraintName: 'FK_raid_contributions_study_session_id_study_sessions' })
  studySession?: StudySession | null;

  @Column({ name: 'study_session_id', type: 'varchar', length: '36', nullable: true })
  studySessionId?: string | null;

  @Column({ name: 'xp_contributed' })
  xpContributed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
