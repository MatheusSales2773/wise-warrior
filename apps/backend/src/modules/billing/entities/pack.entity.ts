import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Um Pacote vendido por dinheiro na Loja (ADR-015). Os itens dele são os Cosmetic Items com Condição `pack:<slug>`. */
@Entity('packs')
@Unique('UQ_packs_slug', ['slug'])
export class Pack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  /** Falso tira o Pacote da Loja sem tirá-lo de quem já pagou. */
  @Column({ name: 'for_sale', default: false })
  forSale: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
