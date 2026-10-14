import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Fechamento semanal (#116): uma Guild tem no máximo uma Raid por semana, mesmo que o job semanal e a
 * execução ao subir a aplicação rodem ao mesmo tempo.
 */
export class AddRaidGuildWeekUnique1788459540000 implements MigrationInterface {
  name = 'AddRaidGuildWeekUnique1788459540000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('raids', new TableIndex({
      name: 'UQ_raids_guild_id_starts_at',
      columnNames: ['guild_id', 'starts_at'],
      isUnique: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('raids', 'UQ_raids_guild_id_starts_at');
  }
}
