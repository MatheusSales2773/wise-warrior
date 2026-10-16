import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-012: Cosmetic Item À venda. `price` (Moedas) e `for_sale` ficam no item; o CHECK impede À venda em Recompensa de
 * Raid, item de nível e Item premium, e fora da faixa de 30 a 300, mesmo para quem escreve direto no banco.
 */
export class AddCosmeticItemSale1788459720000 implements MigrationInterface {
  name = 'AddCosmeticItemSale1788459720000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE cosmetic_items ADD COLUMN price INT UNSIGNED NULL');
    await queryRunner.query('ALTER TABLE cosmetic_items ADD COLUMN for_sale TINYINT(1) NOT NULL DEFAULT 0');
    await queryRunner.query(
      `ALTER TABLE cosmetic_items ADD CONSTRAINT CHK_cosmetic_items_for_sale CHECK (
         for_sale = 0 OR (unlock_condition = 'purchase' AND requires_premium = 0 AND price BETWEEN 30 AND 300)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE cosmetic_items DROP CHECK CHK_cosmetic_items_for_sale');
    await queryRunner.query('ALTER TABLE cosmetic_items DROP COLUMN for_sale');
    await queryRunner.query('ALTER TABLE cosmetic_items DROP COLUMN price');
  }
}
