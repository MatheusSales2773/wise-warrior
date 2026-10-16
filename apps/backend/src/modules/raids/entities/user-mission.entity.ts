import { CreateDateColumn, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Mission } from './mission.entity';

/**
 * Posse de uma Missão comprada na Loja (ADR-012): fica com o usuário para sempre. As Missões do rodízio não
 * têm linha aqui, porque todo usuário as possui.
 */
@Entity('user_missions')
@Unique('UQ_user_missions_user_id_mission_id', ['userId', 'missionId'])
export class UserMission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_user_missions_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @ManyToOne(() => Mission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id', foreignKeyConstraintName: 'FK_user_missions_mission_id_missions' })
  mission: Mission;

  @Column({ name: 'mission_id', type: 'varchar', length: '36' })
  missionId: string;

  @CreateDateColumn({ name: 'acquired_at', type: 'datetime', precision: 6 })
  acquiredAt: Date;
}
