import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categoria Arma (#257, ADR-013): a Espada é o Item inicial (nível 1), Cajado e Besta entram À venda com preço
 * provisório dentro da faixa 30–300 do ADR-012 (o PO ajusta). Ids fixos para o seed ser versionado.
 */
export const SWORD_ID = 'c05e71c0-0000-4000-8000-000000000301';
export const STAFF_ID = 'c05e71c0-0000-4000-8000-000000000302';
export const CROSSBOW_ID = 'c05e71c0-0000-4000-8000-000000000303';

interface Weapon {
  id: string;
  name: string;
  unlockCondition: 'level:1' | 'purchase';
  /** Moedas; só quem está À venda tem preço. */
  price: number | null;
  forSale: boolean;
}

const WEAPONS: readonly Weapon[] = [
  { id: SWORD_ID, name: 'Espada', unlockCondition: 'level:1', price: null, forSale: false },
  { id: STAFF_ID, name: 'Cajado', unlockCondition: 'purchase', price: 90, forSale: true },
  { id: CROSSBOW_ID, name: 'Besta', unlockCondition: 'purchase', price: 150, forSale: true },
];

export class AddWeaponCategory1788460440000 implements MigrationInterface {
  name = 'AddWeaponCategory1788460440000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium, price, for_sale)
       VALUES ${WEAPONS.map(() => "(?, 'weapon', ?, ?, 0, ?, ?)").join(', ')}
       ON DUPLICATE KEY UPDATE id = id`,
      WEAPONS.flatMap(({ id, name, unlockCondition, price, forSale }) => [id, name, unlockCondition, price, forSale ? 1 : 0]),
    );

    // Os Characters existentes ganham a Espada. O índice único (usuário + item) torna a concessão idempotente.
    await queryRunner.query(
      `INSERT INTO user_cosmetic_items (id, user_id, cosmetic_item_id, equipped)
       SELECT UUID(), c.user_id, ?, 0 FROM characters c
       ON DUPLICATE KEY UPDATE cosmetic_item_id = user_cosmetic_items.cosmetic_item_id`,
      [SWORD_ID],
    );

    // Equipa só onde ainda não há Arma equipada: uma segunda execução não troca a escolha de ninguém.
    await queryRunner.query(
      `UPDATE user_cosmetic_items sword
       SET sword.equipped = 1
       WHERE sword.cosmetic_item_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM (
             SELECT uci.user_id FROM user_cosmetic_items uci
             JOIN cosmetic_items ci ON ci.id = uci.cosmetic_item_id
             WHERE uci.equipped = 1 AND ci.category = 'weapon'
           ) equipped_weapon WHERE equipped_weapon.user_id = sword.user_id
         )`,
      [SWORD_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE), inclusive Cajado e Besta já comprados;
    // as Moedas gastas não voltam. É o mesmo comportamento dos demais seeds do Catálogo.
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [WEAPONS.map(({ id }) => id)]);
  }
}
