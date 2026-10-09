import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabela inicial de recompensas (#102). Os ids são fixos para que o seed seja versionado. */
const INITIAL_COSMETIC_ITEMS = [
  ['c05e71c0-0000-4000-8000-000000000001', 'avatar', 'Capuz do Erudito', 'level:1', 0],
  ['c05e71c0-0000-4000-8000-000000000002', 'title', 'Aprendiz', 'level:1', 0],
  ['c05e71c0-0000-4000-8000-000000000003', 'badge', 'Madrugador', 'level:3', 0],
  ['c05e71c0-0000-4000-8000-000000000004', 'title', 'Estudante Crepuscular', 'level:5', 0],
  ['c05e71c0-0000-4000-8000-000000000005', 'avatar', 'Manto da Vigília', 'level:8', 0],
  ['c05e71c0-0000-4000-8000-000000000006', 'badge', 'Cem Sessões', 'level:12', 0],
  ['c05e71c0-0000-4000-8000-000000000007', 'accessory', 'Selo dos Madrugadores', 'raid:*', 0],
  ['c05e71c0-0000-4000-8000-000000000008', 'title', 'Mestre da Aurora', 'level:15', 1],
] as const;

const SEEDED_IDS = INITIAL_COSMETIC_ITEMS.map(([id]) => id);

export class SeedInitialCosmeticItems1788459240000 implements MigrationInterface {
  name = 'SeedInitialCosmeticItems1788459240000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ${INITIAL_COSMETIC_ITEMS.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
      INITIAL_COSMETIC_ITEMS.flat(),
    );

    // Regra de Desbloqueio aplicada uma vez aos Characters existentes. O índice único (usuário + item) a torna idempotente.
    await queryRunner.query(`
      INSERT IGNORE INTO user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
      SELECT UUID(), c.user_id, ci.id, 0
      FROM characters c
      JOIN cosmetic_items ci
        ON ci.unlock_condition REGEXP '^level:[1-9][0-9]*$'
       AND CAST(SUBSTRING(ci.unlock_condition, 7) AS UNSIGNED) <= c.level
    `);

    // Itens iniciais só são equipados nas categorias em que o Character ainda não tem item equipado.
    const starters = (await queryRunner.query(
      `SELECT uci.id
       FROM user_cosmetic_items uci
       JOIN cosmetic_items ci ON ci.id = uci.cosmetic_item_id
       WHERE ci.unlock_condition = 'level:1'
         AND ci.id IN (?)
         AND NOT EXISTS (
           SELECT 1 FROM user_cosmetic_items equipped_row
           JOIN cosmetic_items equipped_item ON equipped_item.id = equipped_row.cosmetic_item_id
           WHERE equipped_row.user_id = uci.user_id
             AND equipped_row.equipped = 1
             AND equipped_item.category = ci.category
         )`,
      [SEEDED_IDS],
    )) as Array<{ id: string }>;
    if (starters.length > 0) {
      await queryRunner.query(
        'UPDATE user_cosmetic_items SET equipped = 1 WHERE id IN (?)',
        [starters.map((row) => row.id)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE).
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [SEEDED_IDS]);
  }
}
