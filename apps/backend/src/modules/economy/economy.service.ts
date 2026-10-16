import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { decodeDatetimeCursor, encodeDatetimeCursor } from '../../shared/pagination/datetime-cursor';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinLedgerEntry } from './entities/coin-ledger-entry.entity';
import type { CoinMovementResult, CoinOrigin } from './domain/coin-origin';
import { InsufficientCoinsError } from './domain/insufficient-coins-error';
import { COIN_STATEMENT_PAGE_SIZE_DEFAULT, type CoinStatementQueryDto } from './dto/coin-statement-query.dto';
import type { CoinStatementItemDto, CoinStatementPageDto } from './dto/coin-statement-response.dto';

/**
 * Dono da Moeda (ADR-012). Outros módulos chamam este Service, nunca as tabelas (ADR-001). `credit` e `debit`
 * recebem o EntityManager da transação de quem chama, então a Moeda e o efeito que a gerou são commitados juntos;
 * `publishBalanceChanged` roda depois do commit, e só quando `applied` é verdadeiro. Quem chama trava a linha de
 * `users` antes de qualquer leitura consistente da transação (como a transição de Study Session): a checagem de
 * origem já aplicada, quando falta saldo, depende disso.
 */
@Injectable()
export class EconomyService {
  constructor(
    @InjectRepository(CoinBalance) private readonly balances: Repository<CoinBalance>,
    @InjectRepository(CoinLedgerEntry) private readonly ledger: Repository<CoinLedgerEntry>,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Crédito idempotente por origem. Precisa de uma transação aberta em `manager`. */
  credit(manager: EntityManager, userId: string, amount: number, origin: CoinOrigin): Promise<CoinMovementResult> {
    return this.move(manager, userId, amount, origin, 1);
  }

  /** Débito idempotente por origem; lança `InsufficientCoinsError` sem alterar nada quando o saldo não basta. */
  debit(manager: EntityManager, userId: string, amount: number, origin: CoinOrigin): Promise<CoinMovementResult> {
    return this.move(manager, userId, amount, origin, -1);
  }

  async getBalance(userId: string): Promise<number> {
    const row = await this.balances.findOne({ where: { userId } });
    return row?.balance ?? 0;
  }

  /** Extrato do usuário, do lançamento mais recente para o mais antigo. */
  async listStatement(userId: string, query: CoinStatementQueryDto): Promise<CoinStatementPageDto> {
    const limit = query.limit ?? COIN_STATEMENT_PAGE_SIZE_DEFAULT;
    const after = query.cursor ? decodeDatetimeCursor(query.cursor) : null;

    // O cursor leva o `created_at` como o MySQL o escreveu: um Date em JavaScript arredondaria a precisão.
    const rows = await this.ledger.query<Array<{
      id: string;
      amount: number | string;
      balance_after: number | string;
      origin_type: CoinStatementItemDto['origin']['type'];
      origin_ref: string;
      created_at: Date;
      created_at_text: string;
    }>>(
      `SELECT entry.id, entry.amount, entry.balance_after, entry.origin_type, entry.origin_ref, entry.created_at,
              DATE_FORMAT(entry.created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at_text
       FROM coin_ledger_entries entry
       WHERE entry.user_id = ?
         ${after ? 'AND (entry.created_at < ? OR (entry.created_at = ? AND entry.id < ?))' : ''}
       ORDER BY entry.created_at DESC, entry.id DESC
       LIMIT ?`,
      [userId, ...(after ? [after.datetime, after.datetime, after.id] : []), limit + 1],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row): CoinStatementItemDto => ({
        id: row.id,
        amount: Number(row.amount),
        balanceAfter: Number(row.balance_after),
        origin: { type: row.origin_type, ref: row.origin_ref },
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor: rows.length > limit && last ? encodeDatetimeCursor(last.created_at_text, last.id) : null,
    };
  }

  /** Depois do commit: o app do usuário atualiza o saldo sem recarregar (ADR-009). */
  publishBalanceChanged(userId: string, result: CoinMovementResult): void {
    this.realtime.emitToUser(userId, 'coins:changed', {
      balance: result.balance,
      delta: result.delta,
      origin: { type: result.origin.type, ref: result.origin.ref },
    });
  }

  private async move(
    manager: EntityManager,
    userId: string,
    amount: number,
    origin: CoinOrigin,
    sign: 1 | -1,
  ): Promise<CoinMovementResult> {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error('A quantidade de Moedas deve ser um inteiro não negativo');
    }
    const balances = manager.getRepository(CoinBalance);
    if (amount === 0) {
      const current = await balances.findOne({ where: { userId } });
      return { applied: false, balance: current?.balance ?? 0, delta: 0, origin };
    }

    // ON DUPLICATE KEY UPDATE, e não INSERT IGNORE: com a linha já existente, o IGNORE pega trava compartilhada, e
    // duas transações que em seguida pedem a trava exclusiva do FOR UPDATE se bloqueiam (deadlock). Este upsert
    // pega a trava exclusiva direto, e as transações se enfileiram.
    await manager.query(
      'INSERT INTO coin_balances (user_id, balance, updated_at) VALUES (?, 0, ?) ON DUPLICATE KEY UPDATE user_id = user_id',
      [userId, new Date()],
    );
    const row = await balances.findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });
    if (!row) throw new Error('Saldo de Moedas indisponível para este usuário');

    const delta = sign * amount;
    const next = row.balance + delta;
    const ledgerEntries = manager.getRepository(CoinLedgerEntry);
    if (sign < 0 && row.balance < amount) {
      // Sem saldo: se a origem já valeu, a repetição não muda nada e não lança erro. A leitura não tem trava, porque o
      // lock de coin_balances acima já serializa quem mexe no saldo deste usuário. Nada é gravado neste caminho.
      const alreadyApplied = await ledgerEntries.exists({
        where: { userId, originType: origin.type, originRef: origin.ref },
      });
      if (alreadyApplied) return { applied: false, balance: row.balance, delta: 0, origin };
      throw new InsufficientCoinsError(-next);
    }

    // A UNIQUE (usuário, origem, referência) decide se a origem já valeu. A inserção lê o último estado commitado;
    // uma leitura com trava nessa chave ausente pegaria trava de intervalo, e duas transações de usuários diferentes
    // que inserem nesse intervalo se bloqueiam (deadlock).
    const now = new Date();
    try {
      await ledgerEntries.insert({
        id: randomUUID(),
        userId,
        amount: delta,
        balanceAfter: next,
        originType: origin.type,
        originRef: origin.ref,
        createdAt: now,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return { applied: false, balance: row.balance, delta: 0, origin };
      throw error;
    }
    await balances.update({ userId }, { balance: next, updatedAt: now });
    return { applied: true, balance: next, delta, origin };
  }
}
