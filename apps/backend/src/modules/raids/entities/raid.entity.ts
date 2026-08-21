import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guild } from '../../guilds/entities/guild.entity';

export type RaidStatus = 'active' | 'completed' | 'expired';

@Entity('raids')
export class Raid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  guild: Guild;

  @Column({ name: 'guild_id' })
  guildId: string;

  @Column()
  title: string;

  @Column({ name: 'goal_xp' })
  goalXp: number;

  @Column({ name: 'progress_xp', default: 0 })
  progressXp: number;

  @Column({ name: 'starts_at', type: 'datetime' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'datetime' })
  endsAt: Date;

  @Column({ type: 'varchar', default: 'active' })
  status: RaidStatus;
}
