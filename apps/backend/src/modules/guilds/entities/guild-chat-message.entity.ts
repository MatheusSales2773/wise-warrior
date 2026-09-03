import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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
  guild: Guild;

  @Column({ name: 'guild_id' })
  @Index()
  guildId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
