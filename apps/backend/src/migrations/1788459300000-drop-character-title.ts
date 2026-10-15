import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** ADR-010: o Título é o Cosmetic Item de categoria Título equipado; o título textual do Character sai. */
export class DropCharacterTitle1788459300000 implements MigrationInterface {
  name = 'DropCharacterTitle1788459300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('characters', 'title');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'characters',
      new TableColumn({ name: 'title', type: 'varchar', length: '255', isNullable: true }),
    );
    // Versões anteriores leem o título textual: ele volta com o nome do Título equipado.
    await queryRunner.query(`
      UPDATE characters c
      JOIN user_cosmetic_items uci ON uci.user_id = c.user_id AND uci.equipped = 1
      JOIN cosmetic_items ci ON ci.id = uci.cosmetic_item_id AND ci.category = 'title'
      SET c.title = ci.name
    `);
  }
}
