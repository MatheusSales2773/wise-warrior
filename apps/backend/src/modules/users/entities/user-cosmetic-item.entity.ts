import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { CosmeticItem } from './cosmetic-item.entity';

@Entity('user_cosmetic_items')
export class UserCosmeticItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => CosmeticItem, { onDelete: 'CASCADE' })
  cosmeticItem: CosmeticItem;

  @Column({ name: 'cosmetic_item_id' })
  cosmeticItemId: string;

  @Column({ default: false })
  equipped: boolean;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
