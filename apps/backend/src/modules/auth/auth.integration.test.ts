import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { Character } from '../progression/entities/character.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { Session } from './entities/session.entity';
import { RefreshTokenHistory } from './entities/refresh-token-history.entity';
import { sha256Hex } from '../../shared/security/hash.util';
import {
  APPLICATION_MIGRATIONS,
  createIntegrationDatabase,
  type IntegrationDatabase,
} from '../../test/integration-database';

type Row = RowDataPacket & Record<string, unknown>;

describe('AuthService refresh rotation against independent MySQL connections', () => {
  jest.setTimeout(30_000);

  let database: IntegrationDatabase | undefined;
  let first: DataSource | undefined;
  let second: DataSource | undefined;

  afterEach(async () => {
    try {
      if (second?.isInitialized) {
        await second.destroy();
      }
      if (first?.isInitialized) {
        await first.destroy();
      }
    } finally {
      await database?.close();
    }
  });

  async function rows(dataSource: DataSource, sql: string, values: unknown[] = []) {
    return (await dataSource.query(sql, values)) as Row[];
  }

  async function setup(): Promise<void> {
    database = await createIntegrationDatabase('wise_auth_integration');
    const migrationOptions = database.options(APPLICATION_MIGRATIONS);
    first = new DataSource(migrationOptions);
    await first.initialize();
    await first.runMigrations();
    second = new DataSource(migrationOptions);
    await second.initialize();
  }

  function authService(dataSource: DataSource): AuthService {
    const config = {
      get: (key: string): string | number | undefined => {
        if (key === 'JWT_ACCESS_SECRET') return 'integration-access-secret';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL_DAYS') return 30;
        if (key === 'MAX_SESSIONS_PER_USER') return 5;
        return undefined;
      },
    } as ConfigService;
    return new AuthService(
      dataSource.getRepository(User),
      dataSource.getRepository(Character),
      dataSource.getRepository(Session),
      new JwtService(),
      config,
      dataSource,
    );
  }

  async function seedSession(secret = 'old-secret') {
    if (!first) {
      throw new Error('First data source was not initialized');
    }
    const userId = '00000000-0000-4000-8000-000000000001';
    const sessionId = '00000000-0000-4000-8000-000000000002';
    await first.getRepository(User).insert({
      id: userId,
      email: 'integration@example.com',
      passwordHash: 'argon2-hash',
      displayName: 'Integration',
      planTier: 'free',
    });
    await first.getRepository(Session).insert({
      id: sessionId,
      userId,
      refreshTokenHash: sha256Hex(secret),
      lastUsedAt: new Date(Date.now() - 60_000),
    });
    return { sessionId, userId, token: `${sessionId}.${secret}` };
  }

  it('rotates, stores only the consumed hash, and confirms family revocation before replay 401', async () => {
    await setup();
    const seeded = await seedSession();
    const firstAuth = authService(first!);
    const secondAuth = authService(second!);

    const successor = await firstAuth.refresh(seeded.token);
    expect(successor.refreshToken).toMatch(new RegExp(`^${seeded.sessionId}\\.[a-f0-9]{64}$`));
    const historyRows = await rows(
      second!,
      `SELECT session_id, token_hash, consumed_at, retain_until
       FROM ${database!.identifier}.session_refresh_token_history`,
    );
    expect(historyRows).toEqual([
      expect.objectContaining({
        session_id: seeded.sessionId,
        token_hash: sha256Hex('old-secret'),
      }),
    ]);
    expect(JSON.stringify(historyRows)).not.toContain('old-secret');

    await expect(secondAuth.refresh(seeded.token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const revokedRows = await rows(
      first!,
      `SELECT revoked_at, refresh_token_hash FROM ${database!.identifier}.sessions
       WHERE id = ?`,
      [seeded.sessionId],
    );
    expect(revokedRows[0]!.revoked_at).not.toBeNull();
    expect(revokedRows[0]!.refresh_token_hash).not.toBe(sha256Hex('old-secret'));
    await expect(secondAuth.refresh(successor.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows at most one successor when two independent connections refresh concurrently', async () => {
    await setup();
    const seeded = await seedSession();
    const results = await Promise.allSettled([
      authService(first!).refresh(seeded.token),
      authService(second!).refresh(seeded.token),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      UnauthorizedException,
    );
    const successor = results.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<AuthService['refresh']>>> =>
        result.status === 'fulfilled',
    );
    expect(successor).toBeDefined();
    await expect(
      authService(first!).refresh(successor!.value.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const historyRows = await rows(
      first!,
      `SELECT token_hash FROM ${database!.identifier}.session_refresh_token_history
       WHERE session_id = ?`,
      [seeded.sessionId],
    );
    expect(historyRows).toHaveLength(1);
  });

  it('does not revoke a known session for a random secret', async () => {
    await setup();
    const seeded = await seedSession();

    await expect(
      authService(second!).refresh(`${seeded.sessionId}.random-secret`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const sessionRows = await rows(
      first!,
      `SELECT revoked_at, refresh_token_hash FROM ${database!.identifier}.sessions
       WHERE id = ?`,
      [seeded.sessionId],
    );
    expect(sessionRows[0]!.revoked_at).toBeNull();
    expect(sessionRows[0]!.refresh_token_hash).toBe(sha256Hex('old-secret'));
  });

  it('rolls back history and Session atomically when recording the consumed hash fails', async () => {
    await setup();
    const seeded = await seedSession();
    await first!.getRepository(RefreshTokenHistory).insert({
      sessionId: seeded.sessionId,
      tokenHash: sha256Hex('old-secret'),
      consumedAt: new Date(),
      retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await expect(authService(second!).refresh(seeded.token)).rejects.toThrow();
    const sessionRows = await rows(
      first!,
      `SELECT refresh_token_hash, revoked_at FROM ${database!.identifier}.sessions
       WHERE id = ?`,
      [seeded.sessionId],
    );
    expect(sessionRows[0]).toEqual(
      expect.objectContaining({
        refresh_token_hash: sha256Hex('old-secret'),
        revoked_at: null,
      }),
    );
    const historyRows = await rows(
      first!,
      `SELECT COUNT(*) AS count FROM ${database!.identifier}.session_refresh_token_history
       WHERE session_id = ?`,
      [seeded.sessionId],
    );
    expect(Number(historyRows[0]!.count)).toBe(1);
  });
});
