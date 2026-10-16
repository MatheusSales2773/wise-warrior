import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * #169: a Missão passa a ter vários Cosmetic Items de recompensa. A coluna única `missions.reward_cosmetic_item_id`
 * vira a tabela `mission_reward_items`, e cada Missão existente mantém o item que já tinha.
 */
export class AddMissionRewardItems1788459960000 implements MigrationInterface {
  name = 'AddMissionRewardItems1788459960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'mission_reward_items',
      engine: 'InnoDB',
      columns: [
        { name: 'mission_id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'cosmetic_item_id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
      ],
      foreignKeys: [
        {
          name: 'FK_mission_reward_items_mission_id_missions',
          columnNames: ['mission_id'],
          referencedTableName: 'missions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
        {
          name: 'FK_mission_reward_items_cosmetic_item_id_cosmetic_items',
          columnNames: ['cosmetic_item_id'],
          referencedTableName: 'cosmetic_items',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        },
      ],
    }));
    await queryRunner.query(
      `INSERT INTO mission_reward_items (mission_id, cosmetic_item_id)
       SELECT id, reward_cosmetic_item_id FROM missions`,
    );
    await queryRunner.query('ALTER TABLE missions DROP FOREIGN KEY FK_missions_reward_cosmetic_item_id_cosmetic_items');
    await queryRunner.query('ALTER TABLE missions DROP COLUMN reward_cosmetic_item_id');
  }

  /** Volta ao item único: a Missão fica com o item de menor id, e os demais deixam de ser recompensa. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE missions ADD COLUMN reward_cosmetic_item_id varchar(36) NULL AFTER image_url');
    await queryRunner.query(
      `UPDATE missions m
       SET m.reward_cosmetic_item_id = (
         SELECT MIN(r.cosmetic_item_id) FROM mission_reward_items r WHERE r.mission_id = m.id
       )`,
    );
    await queryRunner.query('ALTER TABLE missions MODIFY COLUMN reward_cosmetic_item_id varchar(36) NOT NULL');
    await queryRunner.query(
      `ALTER TABLE missions ADD CONSTRAINT FK_missions_reward_cosmetic_item_id_cosmetic_items
       FOREIGN KEY (reward_cosmetic_item_id) REFERENCES cosmetic_items (id) ON DELETE RESTRICT`,
    );
    await queryRunner.dropTable('mission_reward_items');
  }
}
