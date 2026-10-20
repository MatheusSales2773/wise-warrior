import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/** Guarda a participação em Raids (#113). Quem já contribuiu antes passa a constar como Participante. */
export class AddRaidParticipations1788459420000 implements MigrationInterface {
  name = 'AddRaidParticipations1788459420000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'raid_participations',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'raid_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
      ],
      indices: [
        { name: 'UQ_raid_participations_raid_id_user_id', columnNames: ['raid_id', 'user_id'], isUnique: true },
        { name: 'IDX_raid_participations_user_id', columnNames: ['user_id'] },
      ],
      foreignKeys: [
        {
          name: 'FK_raid_participations_raid_id_raids',
          columnNames: ['raid_id'],
          referencedTableName: 'raids',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_raid_participations_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
    await queryRunner.query(
      `INSERT INTO raid_participations (id, raid_id, user_id)
       SELECT UUID(), raid_id, user_id FROM raid_contributions GROUP BY raid_id, user_id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('raid_participations');
  }
}
