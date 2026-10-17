import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Fúria do dragão (#195, ADR-012): a Raid guarda a vida que o chefe já recuperou (`regenerated_xp`), o último dia
 * da Fúria já aplicado (`fury_through`, `YYYY-MM-DD` de São Paulo, o que faz cada Raid e dia regenerar uma vez) e o
 * instante em que abriu (`opened_at`, o dia parcial de criação não regenera; nulo vale `starts_at`).
 */
export class AddRaidDragonFury1788460320000 implements MigrationInterface {
  name = 'AddRaidDragonFury1788460320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('raids', [
      new TableColumn({ name: 'regenerated_xp', type: 'int', isNullable: false, default: 0 }),
      new TableColumn({ name: 'fury_through', type: 'varchar', length: '10', isNullable: true }),
      new TableColumn({ name: 'opened_at', type: 'datetime', precision: 3, isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('raids', ['opened_at', 'fury_through', 'regenerated_xp']);
  }
}
