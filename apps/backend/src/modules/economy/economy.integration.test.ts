import { DataSource, type EntityManager } from 'typeorm';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/entities/user.entity';
import { APPLICATION_MIGRATIONS, createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinLedgerEntry } from './entities/coin-ledger-entry.entity';
import type { CoinMovementResult, CoinOrigin } from './domain/coin-origin';
import { InsufficientCoinsError } from './domain/insufficient-coins-error';
import { EconomyService } from './economy.service';

describe('EconomyService against MySQL', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let dataSource: DataSource | undefined;
  let economy: EconomyService;
  let realtime: { emitToUser: jest.Mock };
  const userId = '00000000-0000-4000-8000-000000000081';
  const session = (ref: string): CoinOrigin => ({ type: 'study-session', ref });
  const purchase = (ref: string): CoinOrigin => ({ type: 'purchase', ref });

  const inTransaction = <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => dataSource!.transaction(work);
  const ledgerRows = () => dataSource!.query('SELECT * FROM coin_ledger_entries WHERE user_id = ?', [userId]) as Promise<unknown[]>;

  beforeEach(async () => {
    database = await createIntegrationDatabase('wise_economy');
    dataSource = new DataSource(database.options(APPLICATION_MIGRATIONS));
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).insert({
      id: userId, email: 'moedas@example.com', passwordHash: 'hash', displayName: 'Moedas', planTier: 'free',
    });
    realtime = { emitToUser: jest.fn() };
    economy = new EconomyService(
      dataSource.getRepository(CoinBalance),
      dataSource.getRepository(CoinLedgerEntry),
      realtime as unknown as RealtimeGateway,
    );
  });

  afterEach(async () => {
    await dataSource?.destroy();
    await database?.close();
  });

  it('credits and debits, recording each movement with its sign and the balance after it', async () => {
    expect(await inTransaction((m) => economy.credit(m, userId, 12, session('session-1')))).toMatchObject({
      applied: true, balance: 12, delta: 12,
    });
    expect(await inTransaction((m) => economy.debit(m, userId, 5, purchase('item-1')))).toMatchObject({
      applied: true, balance: 7, delta: -5,
    });

    expect(await economy.getBalance(userId)).toBe(7);
    expect(await dataSource!.query(
      'SELECT amount, balance_after, origin_type, origin_ref FROM coin_ledger_entries WHERE user_id = ? ORDER BY amount DESC',
      [userId],
    )).toEqual([
      { amount: 12, balance_after: 12, origin_type: 'study-session', origin_ref: 'session-1' },
      { amount: -5, balance_after: 7, origin_type: 'purchase', origin_ref: 'item-1' },
    ]);
  });

  it('reads a user without a balance row as zero', async () => {
    expect(await economy.getBalance(userId)).toBe(0);
  });

  it('treats a zero amount as a no-op that writes no statement line', async () => {
    expect(await inTransaction((m) => economy.credit(m, userId, 0, session('nothing')))).toMatchObject({
      applied: false, balance: 0, delta: 0,
    });
    expect(await ledgerRows()).toHaveLength(0);
  });

  it('refuses amounts that are not non-negative integers', async () => {
    for (const amount of [-1, 1.5, Number.NaN]) {
      await expect(inTransaction((m) => economy.credit(m, userId, amount, session('bad'))))
        .rejects.toThrow('inteiro não negativo');
    }
    expect(await ledgerRows()).toHaveLength(0);
  });

  it('applies each origin once: a repeated credit or debit changes nothing', async () => {
    await inTransaction((m) => economy.credit(m, userId, 12, session('session-1')));
    expect(await inTransaction((m) => economy.credit(m, userId, 12, session('session-1')))).toMatchObject({
      applied: false, balance: 12, delta: 0,
    });

    await inTransaction((m) => economy.debit(m, userId, 5, purchase('item-1')));
    expect(await inTransaction((m) => economy.debit(m, userId, 5, purchase('item-1')))).toMatchObject({
      applied: false, balance: 7, delta: 0,
    });

    expect(await economy.getBalance(userId)).toBe(7);
    expect(await ledgerRows()).toHaveLength(2);
  });

  it('refuses a debit above the balance with the shortfall, and changes nothing', async () => {
    await inTransaction((m) => economy.credit(m, userId, 10, session('session-1')));

    const attempt = inTransaction((m) => economy.debit(m, userId, 25, purchase('expensive')));
    await expect(attempt).rejects.toBeInstanceOf(InsufficientCoinsError);
    await expect(attempt).rejects.toMatchObject({ missing: 15 });

    expect(await economy.getBalance(userId)).toBe(10);
    expect(await ledgerRows()).toHaveLength(1);
  });

  it('answers a repeated debit with applied false even after the balance dropped below its amount', async () => {
    await inTransaction((m) => economy.credit(m, userId, 10, session('session-1')));
    await inTransaction((m) => economy.debit(m, userId, 8, purchase('item-1')));
    expect(await economy.getBalance(userId)).toBe(2);

    // The same origin again, with 2 Moedas left for an 8 debit: it already counted, so nothing changes and nothing throws.
    expect(await inTransaction((m) => economy.debit(m, userId, 8, purchase('item-1')))).toMatchObject({
      applied: false, balance: 2, delta: 0,
    });
    expect(await economy.getBalance(userId)).toBe(2);
    expect(await ledgerRows()).toHaveLength(2);

    // A new origin for the same amount still fails, with the shortfall, and writes nothing.
    await expect(inTransaction((m) => economy.debit(m, userId, 8, purchase('item-2')))).rejects.toMatchObject({ missing: 6 });
    expect(await ledgerRows()).toHaveLength(2);
  });

  it('lets exactly one of two concurrent debits pass, with no deadlock, in every round', async () => {
    await inTransaction((m) => economy.credit(m, userId, 10, session('seed')));

    for (let round = 0; round < 10; round += 1) {
      const results = await Promise.allSettled([
        inTransaction((m) => economy.debit(m, userId, 8, purchase(`round-${round}-a`))),
        inTransaction((m) => economy.debit(m, userId, 8, purchase(`round-${round}-b`))),
      ]);

      const passed = results.filter((result): result is PromiseFulfilledResult<CoinMovementResult> => result.status === 'fulfilled');
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(passed).toHaveLength(1);
      expect(passed[0]!.value).toMatchObject({ applied: true, balance: 2, delta: -8 });
      expect(failed).toHaveLength(1);
      expect(failed[0]!.reason).toBeInstanceOf(InsufficientCoinsError);
      expect(failed[0]!.reason).toMatchObject({ missing: 6 });

      // Put the balance back to 10 with a fresh origin before the next round.
      await inTransaction((m) => economy.credit(m, userId, 8, session(`refill-${round}`)));
      expect(await economy.getBalance(userId)).toBe(10);
    }
  });

  it('applies a repeated origin once when two credits race for a user with no balance yet', async () => {
    const results = await Promise.all([
      inTransaction((m) => economy.credit(m, userId, 12, session('same'))),
      inTransaction((m) => economy.credit(m, userId, 12, session('same'))),
    ]);

    expect(results.filter((result) => result.applied)).toHaveLength(1);
    expect(await economy.getBalance(userId)).toBe(12);
    expect(await ledgerRows()).toHaveLength(1);
  });

  it('publishes the change to the user room with its origin', () => {
    economy.publishBalanceChanged(userId, { applied: true, balance: 12, delta: 12, origin: session('session-1') });

    expect(realtime.emitToUser).toHaveBeenCalledWith(userId, 'coins:changed', {
      balance: 12, delta: 12, origin: { type: 'study-session', ref: 'session-1' },
    });
  });

  it('pages the statement newest first, and rejects a cursor it did not issue', async () => {
    await inTransaction((m) => economy.credit(m, userId, 1, session('one')));
    await inTransaction((m) => economy.credit(m, userId, 1, session('two')));
    await inTransaction((m) => economy.credit(m, userId, 1, session('three')));
    // Distinct instants, so the order does not depend on the random ids.
    for (const [ref, at] of [['one', '2026-09-01 10:00:00.100'], ['two', '2026-09-01 10:00:00.200'], ['three', '2026-09-01 10:00:00.300']]) {
      await dataSource!.query('UPDATE coin_ledger_entries SET created_at = ? WHERE origin_ref = ?', [at, ref]);
    }

    const first = await economy.listStatement(userId, { limit: 2 });
    expect(first.items.map((item) => item.origin.ref)).toEqual(['three', 'two']);
    expect(first.nextCursor).not.toBeNull();

    const second = await economy.listStatement(userId, { limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((item) => item.origin.ref)).toEqual(['one']);
    expect(second.nextCursor).toBeNull();

    await expect(economy.listStatement(userId, { cursor: 'not-a-cursor' })).rejects.toThrow('Cursor inválido');
  });
});
