import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Guild } from './guild.entity';
import { User } from '../../users/entities/user.entity';

export type GuildRole = 'leader' | 'member';

@Entity('guild_memberships')
@Unique(['guildId', 'userId'])
export class GuildMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  guild: Guild;

  @Column({ name: 'guild_id' })
  guildId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', default: 'member' })
  role: GuildRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
