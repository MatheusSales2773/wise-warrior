import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Guild } from './guild.entity';
import { User } from '../../users/entities/user.entity';

export type GuildRole = 'leader' | 'member';

@Entity('guild_memberships')
@Unique('UQ_guild_memberships_guild_id_user_id', ['guildId', 'userId'])
export class GuildMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id', foreignKeyConstraintName: 'FK_guild_memberships_guild_id_guilds' })
  guild: Guild;

  @Column({ name: 'guild_id', type: 'varchar', length: '36' })
  guildId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_guild_memberships_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  @Index('IDX_guild_memberships_user_id')
  userId: string;

  @Column({ type: 'varchar', default: 'member' })
  role: GuildRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
