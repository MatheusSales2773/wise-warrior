import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * ADR-012: Moeda por usuário. `coin_balances` guarda o saldo (sem linha, o saldo é zero) e
 * `coin_ledger_entries` é o Extrato, com um crédito ou débito por origem. A UNIQUE (usuário, origem, referência)
 * garante a idempotência; o índice (usuário, data, id) serve a paginação do Extrato.
 */
export class AddCoinEconomy1788459660000 implements MigrationInterface {
  name = 'AddCoinEconomy1788459660000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'coin_balances',
      engine: 'InnoDB',
      columns: [
        { name: 'user_id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'balance', type: 'int', unsigned: true, default: 0, isNullable: false },
        { name: 'updated_at', type: 'datetime', precision: 3, isNullable: false },
      ],
      foreignKeys: [
        {
          name: 'FK_coin_balances_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
    await queryRunner.createTable(new Table({
      name: 'coin_ledger_entries',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'amount', type: 'int', isNullable: false },
        { name: 'balance_after', type: 'int', unsigned: true, isNullable: false },
        {
          name: 'origin_type',
          type: 'enum',
          enum: ['study-session', 'raid-win', 'purchase', 'signup', 'migration'],
          isNullable: false,
        },
        { name: 'origin_ref', type: 'varchar', length: '64', isNullable: false },
        { name: 'created_at', type: 'datetime', precision: 3, isNullable: false },
      ],
      indices: [
        {
          name: 'UQ_coin_ledger_entries_user_id_origin_type_origin_ref',
          columnNames: ['user_id', 'origin_type', 'origin_ref'],
          isUnique: true,
        },
        { name: 'IDX_coin_ledger_entries_user_id_created_at_id', columnNames: ['user_id', 'created_at', 'id'] },
      ],
      foreignKeys: [
        {
          name: 'FK_coin_ledger_entries_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('coin_ledger_entries');
    await queryRunner.dropTable('coin_balances');
  }
}
