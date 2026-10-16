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

  /** Posição no rodízio, a partir de 1. Nulo nas Missões à venda, que ficam fora do rodízio. */
  @Column({ name: 'rotation_order', type: 'int', nullable: true })
  rotationOrder: number | null;

  /** Preço em Moedas (ADR-012). Nulo é Missão do rodízio: grátis, fora da Loja e de todo usuário. */
  @Column({ type: 'int', unsigned: true, nullable: true })
  price: number | null;
}
