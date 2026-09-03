import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Guild } from './guild.entity';
import { User } from '../../users/entities/user.entity';

@Entity('guild_chat_messages')
export class GuildChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id', foreignKeyConstraintName: 'FK_guild_chat_messages_guild_id_guilds' })
  guild: Guild;

  @Column({ name: 'guild_id', type: 'varchar', length: '36' })
  @Index('IDX_guild_chat_messages_guild_id')
  guildId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_guild_chat_messages_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  @Index('IDX_guild_chat_messages_user_id')
  userId: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
