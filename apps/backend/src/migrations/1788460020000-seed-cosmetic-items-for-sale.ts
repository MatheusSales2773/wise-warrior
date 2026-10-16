import { MigrationInterface, QueryRunner } from 'typeorm';

/** Catálogo À venda da Loja (#174): ids fixos, Condição de desbloqueio `purchase` e preço entre 30 e 300 Moedas. */
const ITEMS_FOR_SALE = [
  ['c05e71c0-0000-4000-8000-000000000101', 'accessory', 'Marcador de Fita', 30],
  ['c05e71c0-0000-4000-8000-000000000102', 'title', 'Guardião das Páginas', 45],
  ['c05e71c0-0000-4000-8000-000000000103', 'accessory', 'Pena do Escriba', 60],
  ['c05e71c0-0000-4000-8000-000000000104', 'title', 'Andarilho do Saber', 90],
  ['c05e71c0-0000-4000-8000-000000000105', 'avatar', 'Túnica do Viajante', 120],
  ['c05e71c0-0000-4000-8000-000000000106', 'accessory', 'Lanterna do Vigia', 180],
  ['c05e71c0-0000-4000-8000-000000000107', 'title', 'Arquimago dos Prazos', 240],
  ['c05e71c0-0000-4000-8000-000000000108', 'avatar', 'Manto Estelar', 300],
] as const;

const SEEDED_IDS = ITEMS_FOR_SALE.map(([id]) => id);

/** Item temporário da #167, já aplicado nos bancos locais dos devs; o DELETE é idempotente. */
const TEST_ITEM_ID = 'c05e71c0-0000-4000-8000-00000000f001';

export class SeedCosmeticItemsForSale1788460020000 implements MigrationInterface {
  name = 'SeedCosmeticItemsForSale1788460020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id = ?', [TEST_ITEM_ID]);
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES ${ITEMS_FOR_SALE.map(() => "(?, ?, ?, 'purchase', 0, ?, 1)").join(', ')}`,
      ITEMS_FOR_SALE.flat(),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE). O item de teste não volta.
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [SEEDED_IDS]);
  }
}
