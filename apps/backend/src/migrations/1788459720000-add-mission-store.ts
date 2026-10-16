import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Loja de Missões (#166, ADR-012). A Missão ganha preço: nulo é Missão do rodízio, grátis, fora da Loja e de
 * todos. Só Missões à venda ficam fora do rodízio, então `rotation_order` passa a aceitar nulo (o índice único
 * do MySQL admite vários nulos). A posse é por usuário e única por par.
 */
export class AddMissionStore1788459720000 implements MigrationInterface {
  name = 'AddMissionStore1788459720000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE missions ADD COLUMN price int UNSIGNED NULL AFTER rotation_order');
    await queryRunner.query('ALTER TABLE missions MODIFY COLUMN rotation_order int NULL');

    await queryRunner.createTable(new Table({
      name: 'user_missions',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'mission_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'acquired_at', type: 'datetime', precision: 6, isNullable: false, default: 'CURRENT_TIMESTAMP(6)' },
      ],
      indices: [
        { name: 'UQ_user_missions_user_id_mission_id', columnNames: ['user_id', 'mission_id'], isUnique: true },
        { name: 'IDX_user_missions_mission_id', columnNames: ['mission_id'] },
      ],
      foreignKeys: [
        {
          name: 'FK_user_missions_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_user_missions_mission_id_missions',
          columnNames: ['mission_id'],
          referencedTableName: 'missions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_missions');
    // Missões à venda não têm posição no rodízio: saem junto com o preço, e as Raids delas com elas.
    await queryRunner.query('DELETE FROM raids WHERE mission_id IN (SELECT id FROM missions WHERE rotation_order IS NULL)');
    await queryRunner.query('DELETE FROM missions WHERE rotation_order IS NULL');
    await queryRunner.query('ALTER TABLE missions MODIFY COLUMN rotation_order int NOT NULL');
    await queryRunner.query('ALTER TABLE missions DROP COLUMN price');
  }
}
