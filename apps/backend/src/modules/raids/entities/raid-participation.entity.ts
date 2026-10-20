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

/** A confirmação de participação de um membro numa Raid (UC02). Única por Raid e usuário. */
@Entity('raid_participations')
@Index('UQ_raid_participations_raid_id_user_id', ['raidId', 'userId'], { unique: true })
@Index('IDX_raid_participations_user_id', ['userId'])
export class RaidParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Raid, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raid_id', foreignKeyConstraintName: 'FK_raid_participations_raid_id_raids' })
  raid: Raid;

  @Column({ name: 'raid_id', type: 'varchar', length: '36' })
  raidId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_raid_participations_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
