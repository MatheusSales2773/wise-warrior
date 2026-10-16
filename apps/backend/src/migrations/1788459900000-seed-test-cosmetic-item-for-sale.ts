import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TEMPORÁRIO (#174): um item de teste À venda, só para a Loja não abrir vazia enquanto o catálogo real não existe.
 * O nome deixa explícito que é de teste. Remover quando o seed real entrar (a issue #174 pede isso).
 */
const TEST_ITEM_ID = 'c05e71c0-0000-4000-8000-00000000f001';

export class SeedTestCosmeticItemForSale1788459900000 implements MigrationInterface {
  name = 'SeedTestCosmeticItemForSale1788459900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES (?, 'badge', '[TESTE] Item de teste da Loja - remover', 'purchase', 0, 30, 1)`,
      [TEST_ITEM_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id = ?', [TEST_ITEM_ID]);
  }
}
