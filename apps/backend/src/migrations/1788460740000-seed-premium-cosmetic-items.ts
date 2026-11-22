import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Itens premium ✦ da Assinatura (#354, ADR-015): "Manto do Arquimago", "Cajado Astral" e "Lenda do Foco". Todos têm
 * Condição `level:1` e `requires_premium = 1`, então todo Character os tem no Inventário desde o nível 1, desequipados;
 * quem decide se um `free` os equipa é o Equipar. Ids fixos para o seed ser versionado.
 */
export const MANTO_DO_ARQUIMAGO_ID = 'c05e71c0-0000-4000-8000-000000000401';
export const CAJADO_ASTRAL_ID = 'c05e71c0-0000-4000-8000-000000000402';
export const LENDA_DO_FOCO_ID = 'c05e71c0-0000-4000-8000-000000000403';

const PREMIUM_ITEMS = [
  [MANTO_DO_ARQUIMAGO_ID, 'avatar', 'Manto do Arquimago'],
  [CAJADO_ASTRAL_ID, 'weapon', 'Cajado Astral'],
  [LENDA_DO_FOCO_ID, 'title', 'Lenda do Foco'],
] as const;

const PREMIUM_IDS = PREMIUM_ITEMS.map(([id]) => id);

export class SeedPremiumCosmeticItems1788460740000 implements MigrationInterface {
  name = 'SeedPremiumCosmeticItems1788460740000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ${PREMIUM_ITEMS.map(() => "(?, ?, ?, 'level:1', 1)").join(', ')}
       ON DUPLICATE KEY UPDATE id = id`,
      PREMIUM_ITEMS.flat(),
    );

    // Os Characters existentes ganham os itens sempre desequipados: nenhum item equipado muda. O índice único
    // (usuário + item) torna a concessão idempotente e mantém a escolha de quem já equipou um deles.
    await queryRunner.query(
      `INSERT INTO user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       SELECT UUID(), c.user_id, ci.id, 0 FROM characters c
       JOIN cosmetic_items ci ON ci.id IN (?)
       ON DUPLICATE KEY UPDATE cosmetic_item_id = user_cosmetic_items.cosmetic_item_id`,
      [PREMIUM_IDS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE), como nos demais seeds do Catálogo.
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [PREMIUM_IDS]);
  }
}
