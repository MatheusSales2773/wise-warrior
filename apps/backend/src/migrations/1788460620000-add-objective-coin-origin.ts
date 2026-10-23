import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-014 (Crônicas 4/8, #301): o Objetivo cumprido paga Moedas com uma origem própria no Extrato. SQL direto: o
 * `ALTER ... MODIFY` reescreve o enum inteiro, e o `down` só vale com o Extrato sem lançamentos de Objetivo.
 */
export class AddObjectiveCoinOrigin1788460620000 implements MigrationInterface {
  name = 'AddObjectiveCoinOrigin1788460620000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE coin_ledger_entries MODIFY origin_type enum('study-session','raid-win','purchase','signup','migration','objective') NOT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Um lançamento de Objetivo não cabe no enum anterior: as Moedas pagas saem do saldo junto com o lançamento.
    await queryRunner.query(`
      UPDATE coin_balances balance
      JOIN (SELECT user_id, SUM(amount) AS total FROM coin_ledger_entries WHERE origin_type = 'objective' GROUP BY user_id) paid
        ON paid.user_id = balance.user_id
      SET balance.balance = GREATEST(balance.balance - paid.total, 0)
    `);
    await queryRunner.query("DELETE FROM coin_ledger_entries WHERE origin_type = 'objective'");
    await queryRunner.query(
      "ALTER TABLE coin_ledger_entries MODIFY origin_type enum('study-session','raid-win','purchase','signup','migration') NOT NULL",
    );
  }
}
