import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * ADR-015: a Assinatura premium de um usuário no Stripe. Uma linha por usuário (`UQ_subscriptions_user_id`) e por
 * Customer do Stripe (`UQ_subscriptions_stripe_customer_id`); o webhook acha o usuário pelo Customer. `status` guarda o
 * status do Stripe sem tradução. Apagar o usuário apaga a linha.
 */
export class CreateSubscriptions1788460800000 implements MigrationInterface {
  name = 'CreateSubscriptions1788460800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'subscriptions',
      engine: 'InnoDB',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isNullable: false },
        { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
        { name: 'stripe_customer_id', type: 'varchar', length: '255', isNullable: false },
        { name: 'stripe_subscription_id', type: 'varchar', length: '255', isNullable: true },
        { name: 'status', type: 'varchar', length: '32', isNullable: true },
        { name: 'current_period_end', type: 'datetime', isNullable: true },
        { name: 'cancel_at', type: 'datetime', isNullable: true },
        { name: 'created_at', type: 'datetime', precision: 6, isNullable: false, default: 'CURRENT_TIMESTAMP(6)' },
        { name: 'updated_at', type: 'datetime', precision: 6, isNullable: false, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
      ],
      indices: [
        { name: 'UQ_subscriptions_user_id', columnNames: ['user_id'], isUnique: true },
        { name: 'UQ_subscriptions_stripe_customer_id', columnNames: ['stripe_customer_id'], isUnique: true },
        { name: 'UQ_subscriptions_stripe_subscription_id', columnNames: ['stripe_subscription_id'], isUnique: true },
      ],
      foreignKeys: [
        {
          name: 'FK_subscriptions_user_id_users',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        },
      ],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions');
  }
}
