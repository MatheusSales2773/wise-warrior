import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { forSaleViolation } from '../domain/for-sale';

export type CosmeticCategory = 'avatar' | 'badge' | 'title' | 'accessory';

@Entity('cosmetic_items')
export class CosmeticItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  category: CosmeticCategory;

  @Column()
  name: string;

  /** Ex.: "level:5", "raid:dragao-do-pantano", "purchase" — checado no service, não no schema. */
  @Column({ name: 'unlock_condition' })
  unlockCondition: string;

  /** Flag de entitlement (ADR-007): item marcado como premium no Pitch. */
  @Column({ name: 'requires_premium', default: false })
  requiresPremium: boolean;

  /** Preço em Moedas (30 a 300). Só tem valor num item À venda (ADR-012). */
  @Column({ type: 'int', unsigned: true, nullable: true })
  price: number | null;

  /** À venda na Loja. Exige a Condição de desbloqueio `purchase`, preço válido e item não premium. */
  @Column({ name: 'for_sale', default: false })
  forSale: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  protected assertSellable(): void {
    const violation = forSaleViolation(this);
    if (violation) throw new Error(violation);
  }
}
