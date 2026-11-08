import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * ADR-015: o Pacote vendido por dinheiro na Loja (`packs`) e o Pagamento de um Pacote por um usuário (`pack_payments`).
 * Os itens de um Pacote são os Cosmetic Items com Condição `pack:<slug>`, sem tabela de ligação. Há no máximo um
 * Pagamento por usuário e Pacote, e um por sessão do Checkout. O seed cria o "Pacote do Dragão" e os 3 itens dele com
 * ids fixos; nenhum Character os ganha aqui: só o Pagamento os concede.
 */
export const PACOTE_DO_DRAGAO_ID = 'c05e71c0-0000-4000-8000-000000000501';
export const ELMO_DE_ESCAMAS_ID = 'c05e71c0-0000-4000-8000-000000000404';
export const PRESA_DO_DRAGAO_ID = 'c05e71c0-0000-4000-8000-000000000405';
export const AMULETO_DE_BRASA_ID = 'c05e71c0-0000-4000-8000-000000000406';

const PACK_ITEMS = [
  [ELMO_DE_ESCAMAS_ID, 'avatar', 'Elmo de Escamas'],
  [PRESA_DO_DRAGAO_ID, 'weapon', 'Presa do Dragão'],
  [AMULETO_DE_BRASA_ID, 'accessory', 'Amuleto de Brasa'],
] as const;

const PACK_ITEM_IDS = PACK_ITEMS.map(([id]) => id);

export class CreatePacks1788460860000 implements MigrationInterface {
  name = 'CreatePacks1788460860000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'packs',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'slug', type: 'varchar', length: '64', isNullable: false },
        { name: 'name', type: 'varchar', length: '80', isNullable: false },
        { name: 'description', type: 'varchar', length: '255', isNullable: false },
        { name: 'price_cents', type: 'int', isNullable: false },
        { name: 'currency', type: 'char', length: '3', isNullable: false },
        { name: 'for_sale', type: 'tinyint', width: 1, isNullable: false, default: 0 },
        { name: 'created_at', type: 'datetime', precision: 6, isNullable: false, default: 'CURRENT_TIMESTAMP(6)' },
      ],
      indices: [{ name: 'UQ_packs_slug', columnNames: ['slug'], isUnique: true }],
    }));
    // O TypeORM não cria CHECK no MySQL; o preço de um Pacote é sempre positivo.
    await queryRunner.query('ALTER TABLE packs ADD CONSTRAINT CHK_packs_price_cents CHECK (price_cents > 0)');

    await queryRunner.createTable(new Table({
      name: 'pack_payments',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'pack_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'stripe_checkout_session_id', type: 'varchar', length: '255', isNullable: false },
        { name: 'amount_cents', type: 'int', isNullable: false },
        { name: 'currency', type: 'char', length: '3', isNullable: false },
        { name: 'paid_at', type: 'datetime', isNullable: false },
      ],
      indices: [
        { name: 'UQ_pack_payments_stripe_checkout_session_id', columnNames: ['stripe_checkout_session_id'], isUnique: true },
        { name: 'UQ_pack_payments_user_id_pack_id', columnNames: ['user_id', 'pack_id'], isUnique: true },
      ],
      foreignKeys: [
        {
          name: 'FK_pack_payments_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_pack_payments_pack_id_packs',
          columnNames: ['pack_id'],
          referencedTableName: 'packs',
          referencedColumnNames: ['id'],
        },
      ],
    }));

    await queryRunner.query(
      `INSERT INTO packs (id, slug, name, description, price_cents, currency, for_sale)
       VALUES (?, 'dragao', 'Pacote do Dragão', ?, 490, 'brl', 1)`,
      [PACOTE_DO_DRAGAO_ID, 'Elmo, presa e amuleto forjados no fogo de um dragão. Ficam com você para sempre, em qualquer plano.'],
    );
    await queryRunner.query(
      `INSERT INTO cosmetic_items (id, category, name, unlock_condition, requires_premium)
       VALUES ${PACK_ITEMS.map(() => "(?, ?, ?, 'pack:dragao', 0)").join(', ')}`,
      PACK_ITEMS.flat(),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover o item remove as linhas de Inventário dele (ON DELETE CASCADE), como nos demais seeds do Catálogo.
    await queryRunner.query('DELETE FROM cosmetic_items WHERE id IN (?)', [PACK_ITEM_IDS]);
    await queryRunner.dropTable('pack_payments');
    await queryRunner.dropTable('packs');
  }
}
