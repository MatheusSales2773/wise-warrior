import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CosmeticCategory = 'avatar' | 'badge' | 'title' | 'accessory';

@Entity('cosmetic_items')
export class CosmeticItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  category: CosmeticCategory;

  @Column()
  name: string;

  /** Ex.: "level:5", "raid:dragao-do-pantano" — checado no service, não no schema. */
  @Column({ name: 'unlock_condition' })
  unlockCondition: string;

  /** Flag de entitlement (ADR-007): item marcado como premium no Pitch. */
  @Column({ name: 'requires_premium', default: false })
  requiresPremium: boolean;
}
