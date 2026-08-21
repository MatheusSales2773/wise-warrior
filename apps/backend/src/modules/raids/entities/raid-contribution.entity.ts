import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Raid } from './raid.entity';
import { User } from '../../users/entities/user.entity';
import { StudySession } from '../../sessions/entities/study-session.entity';

/** Índice composto: acelera o GROUP BY userId da query de ranking (RaidsService.ranking). */
@Entity('raid_contributions')
@Index(['raidId', 'userId'])
export class RaidContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Raid, { onDelete: 'CASCADE' })
  raid: Raid;

  @Column({ name: 'raid_id' })
  raidId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => StudySession, { onDelete: 'SET NULL', nullable: true })
  studySession?: StudySession | null;

  @Column({ name: 'study_session_id', nullable: true })
  studySessionId?: string | null;

  @Column({ name: 'xp_contributed' })
  xpContributed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
