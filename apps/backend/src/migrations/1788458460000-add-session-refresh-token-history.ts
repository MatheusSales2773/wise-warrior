import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddSessionRefreshTokenHistory1788458460000
  implements MigrationInterface
{
  name = 'AddSessionRefreshTokenHistory1788458460000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'session_refresh_token_history',
        engine: 'InnoDB',
        columns: [
          {
            name: 'session_id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '255',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'consumed_at',
            type: 'datetime',
            precision: 6,
            isNullable: false,
          },
          {
            name: 'retain_until',
            type: 'datetime',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_session_refresh_token_history_session_id_retain_until',
            columnNames: ['session_id', 'retain_until'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_session_refresh_token_history_session_id_sessions',
            columnNames: ['session_id'],
            referencedTableName: 'sessions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('session_refresh_token_history', true);
  }
}
