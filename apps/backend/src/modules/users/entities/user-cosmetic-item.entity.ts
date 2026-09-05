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
import { User } from './user.entity';
import { CosmeticItem } from './cosmetic-item.entity';

@Entity('user_cosmetic_items')
@Unique('UQ_user_cosmetic_items_user_id_cosmetic_item_id', [
  'userId',
  'cosmeticItemId',
])
@Index('IDX_user_cosmetic_items_cosmetic_item_id', ['cosmeticItemId'])
export class UserCosmeticItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_user_cosmetic_items_user_id_users' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar', length: '36' })
  userId: string;

  @ManyToOne(() => CosmeticItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cosmetic_item_id', foreignKeyConstraintName: 'FK_user_cosmetic_items_cosmetic_item_id_cosmetic_items' })
  cosmeticItem: CosmeticItem;

  @Column({ name: 'cosmetic_item_id', type: 'varchar', length: '36' })
  cosmeticItemId: string;

  @Column({ default: false })
  equipped: boolean;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
