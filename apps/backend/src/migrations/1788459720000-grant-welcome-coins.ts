import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-012: as contas que já existiam recebem as 90 Moedas de boas-vindas uma única vez. O valor fica fixo aqui: uma
 * migration não acompanha a configuração. Quem já tem o lançamento de cadastro ou o desta migration fica de fora, então
 * reaplicar não credita de novo. O saldo é atualizado antes do Extrato, com o mesmo filtro, e o `balance_after` lê o
 * saldo já atualizado.
 */
export class GrantWelcomeCoins1788459720000 implements MigrationInterface {
  name = 'GrantWelcomeCoins1788459720000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const pending = `
      NOT EXISTS (
        SELECT 1 FROM coin_ledger_entries entry
        WHERE entry.user_id = u.id
          AND ((entry.origin_type = 'migration' AND entry.origin_ref = 'welcome') OR entry.origin_type = 'signup')
      )`;
    await queryRunner.query(
      `INSERT INTO coin_balances (user_id, balance, updated_at)
       SELECT u.id, 90, NOW(3) FROM users u WHERE ${pending}
       ON DUPLICATE KEY UPDATE balance = balance + 90, updated_at = NOW(3)`,
    );
    await queryRunner.query(
      `INSERT INTO coin_ledger_entries (id, user_id, amount, balance_after, origin_type, origin_ref, created_at)
       SELECT UUID(), u.id, 90, b.balance, 'migration', 'welcome', NOW(3)
       FROM users u JOIN coin_balances b ON b.user_id = u.id WHERE ${pending}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE coin_balances b
       JOIN coin_ledger_entries entry ON entry.user_id = b.user_id
         AND entry.origin_type = 'migration' AND entry.origin_ref = 'welcome'
       SET b.balance = GREATEST(b.balance - entry.amount, 0)`,
    );
    await queryRunner.query(
      `DELETE FROM coin_ledger_entries WHERE origin_type = 'migration' AND origin_ref = 'welcome'`,
    );
  }
}
