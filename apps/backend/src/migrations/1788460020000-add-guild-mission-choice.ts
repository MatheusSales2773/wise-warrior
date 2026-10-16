import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Escolha da Missão pelo Líder (#168, ADR-012). Uma escolha pendente por Guild para a próxima Raid: o job de
 * segunda a usa e a apaga. `owner_user_id` é o dono declarado de uma Missão à venda; nulo na Missão do rodízio,
 * que é de todos. Se o dono sai da Guild ou da conta, a escolha deixa de valer.
 */
export class AddGuildMissionChoice1788460020000 implements MigrationInterface {
  name = 'AddGuildMissionChoice1788460020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'guild_mission_choices',
      engine: 'InnoDB',
      columns: [
        { name: 'guild_id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'mission_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'owner_user_id', type: 'varchar', length: '36', isNullable: true },
        { name: 'chosen_at', type: 'datetime', precision: 6, isNullable: false, default: 'CURRENT_TIMESTAMP(6)' },
      ],
      foreignKeys: [
        {
          name: 'FK_guild_mission_choices_guild_id_guilds',
          columnNames: ['guild_id'],
          referencedTableName: 'guilds',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_guild_mission_choices_mission_id_missions',
          columnNames: ['mission_id'],
          referencedTableName: 'missions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_guild_mission_choices_owner_user_id_users',
          columnNames: ['owner_user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('guild_mission_choices');
  }
}
