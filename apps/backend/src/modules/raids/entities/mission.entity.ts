import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Catálogo fixo de Missões (seed via migration). Define o tema da Raid e a Recompensa de Raid, não a meta. */
@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column()
  name: string;

  @Column({ length: 140 })
  description: string;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'reward_cosmetic_item_id', type: 'varchar', length: 36 })
  rewardCosmeticItemId: string;

  /** Posição no rodízio, a partir de 1. */
  @Column({ name: 'rotation_order' })
  rotationOrder: number;
}
