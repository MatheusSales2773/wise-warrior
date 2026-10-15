import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Guild } from '../../guilds/entities/guild.entity';
import { Mission } from './mission.entity';

export type RaidStatus = 'active' | 'completed' | 'expired';

@Entity('raids')
@Index('IDX_raids_guild_id', ['guildId'])
export class Raid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id', foreignKeyConstraintName: 'FK_raids_guild_id_guilds' })
  guild: Guild;

  @Column({ name: 'guild_id', type: 'varchar', length: '36' })
  guildId: string;

  /** A Raid herda o título da Missão. */
  @ManyToOne(() => Mission, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mission_id', foreignKeyConstraintName: 'FK_raids_mission_id_missions' })
  mission: Mission;

  @Column({ name: 'mission_id', type: 'varchar', length: '36' })
  missionId: string;

  @Column({ name: 'goal_xp' })
  goalXp: number;

  @Column({ name: 'progress_xp', default: 0 })
  progressXp: number;

  @Column({ name: 'starts_at', type: 'datetime' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'datetime' })
  endsAt: Date;

  /** A primeira vez que o progresso alcançou a meta. Não muda o status nem fecha a Raid. */
  @Column({ name: 'goal_reached_at', type: 'datetime', precision: 3, nullable: true })
  goalReachedAt: Date | null;

  /** `active` durante a semana; só o fechamento decide `completed` (Meta batida) ou `expired`. */
  @Column({ type: 'varchar', default: 'active' })
  status: RaidStatus;
}
