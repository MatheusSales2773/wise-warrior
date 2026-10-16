import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-012 (emenda de 16/10/2026): o Badge é sempre conquistado, nunca À venda. O CHECK passa a recusar `for_sale = 1`
 * em Badge, mesmo para quem escreve direto no banco. Um Badge que já estivesse À venda (o item de teste da #174) sai
 * da Loja antes, senão o ADD CONSTRAINT falharia; o `down` restaura o CHECK anterior e não recoloca nada À venda.
 */
export class KeepBadgesOffSale1788460020000 implements MigrationInterface {
  name = 'KeepBadgesOffSale1788460020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE cosmetic_items SET for_sale = 0 WHERE category = 'badge' AND for_sale = 1");
    await queryRunner.query('ALTER TABLE cosmetic_items DROP CHECK CHK_cosmetic_items_for_sale');
    await queryRunner.query(
      `ALTER TABLE cosmetic_items ADD CONSTRAINT CHK_cosmetic_items_for_sale CHECK (
         for_sale = 0 OR (category <> 'badge' AND unlock_condition = 'purchase' AND requires_premium = 0 AND price BETWEEN 30 AND 300)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE cosmetic_items DROP CHECK CHK_cosmetic_items_for_sale');
    await queryRunner.query(
      `ALTER TABLE cosmetic_items ADD CONSTRAINT CHK_cosmetic_items_for_sale CHECK (
         for_sale = 0 OR (unlock_condition = 'purchase' AND requires_premium = 0 AND price BETWEEN 30 AND 300)
       )`,
    );
  }
}
