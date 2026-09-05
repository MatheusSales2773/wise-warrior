import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Session } from './entities/session.entity';
import { RefreshTokenHistory } from './entities/refresh-token-history.entity';
import { sha256Hex } from '../../shared/security/hash.util';

function session(overrides: Partial<Session> = {}): Session {
  const lastUsedAt = new Date(Date.now() - 60_000);
  return {
    user: undefined as never,
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: sha256Hex('old-secret'),
    deviceLabel: undefined,
    userAgent: undefined,
    createdAt: lastUsedAt,
    lastUsedAt,
    revokedAt: null,
    ...overrides,
  };
}

function serviceWithTransaction(
  sessionRepository: Record<string, jest.Mock>,
  historyRepository: Record<string, jest.Mock>,
  userRepository: Record<string, jest.Mock>,
) {
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Session) return sessionRepository;
      if (entity === RefreshTokenHistory) return historyRepository;
      return userRepository;
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (callback: (transactionManager: typeof manager) => unknown) =>
      callback(manager),
    ),
  };
  const users = {};
  const characters = {};
  const sessions = {};
  const jwt = { sign: jest.fn(() => 'access-token') };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
      if (key === 'JWT_REFRESH_TTL_DAYS') return 30;
      return undefined;
    }),
  };

  return {
    service: new AuthService(
      users as never,
      characters as never,
      sessions as never,
      jwt as never,
      config as never,
      dataSource as never,
    ),
    dataSource,
    manager,
  };
}

describe('AuthService.refresh', () => {
  it('rotates the current credential with the session lock and records only its hash', async () => {
    const currentSession = session();
    const previousLastUsedAt = currentSession.lastUsedAt;
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn().mockResolvedValue(currentSession),
    };
    const historyRepository = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    };
    const { service, dataSource, manager } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      userRepository,
    );

    const result = await service.refresh('session-1.old-secret');

    expect(result.sessionId).toBe('session-1');
    expect(result.refreshToken).toMatch(/^session-1\.[a-f0-9]{64}$/);
    expect(result.refreshToken).not.toBe('session-1.old-secret');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalledWith(Session);
    expect(sessionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(historyRepository.insert).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tokenHash: sha256Hex('old-secret'),
      consumedAt: expect.any(Date),
      retainUntil: new Date(previousLastUsedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
    expect(sessionRepository.save).toHaveBeenCalledWith(currentSession);
    expect(currentSession.refreshTokenHash).not.toBe(sha256Hex('old-secret'));
    expect(historyRepository.delete).toHaveBeenCalledTimes(1);
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: ['id', 'email'],
    });
  });

  it('commits family revocation before returning unauthorized for a retained replay', async () => {
    const lastUsedAt = new Date(Date.now() - 60_000);
    const currentSession = session({
      refreshTokenHash: sha256Hex('new-secret'),
      lastUsedAt,
    });
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn().mockResolvedValue(currentSession),
    };
    const historyRepository = {
      insert: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        tokenHash: sha256Hex('old-secret'),
        consumedAt: lastUsedAt,
        retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const { service, dataSource } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      { findOne: jest.fn() },
    );

    await expect(service.refresh('session-1.old-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(currentSession.revokedAt).toEqual(expect.any(Date));
    expect(sessionRepository.save).toHaveBeenCalledWith(currentSession);
  });

  it('does not revoke a session for an unknown secret under a known session id', async () => {
    const currentSession = session();
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn(),
    };
    const historyRepository = {
      insert: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const { service } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      { findOne: jest.fn() },
    );

    await expect(service.refresh('session-1.random-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(currentSession.revokedAt).toBeNull();
    expect(sessionRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.findOne).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', tokenHash: sha256Hex('random-secret') },
    });
  });

  it('does not revoke an expired replay and cleans only expired history for that session', async () => {
    const currentSession = session({ refreshTokenHash: sha256Hex('new-secret') });
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn(),
    };
    const historyRepository = {
      insert: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        tokenHash: sha256Hex('old-secret'),
        consumedAt: new Date(Date.now() - 2 * 60_000),
        retainUntil: new Date(Date.now() - 1),
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const { service } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      { findOne: jest.fn() },
    );

    await expect(service.refresh('session-1.old-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(currentSession.revokedAt).toBeNull();
    expect(sessionRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.delete).toHaveBeenCalledTimes(1);
    expect(historyRepository.delete.mock.calls[0][0]).toEqual(
      expect.objectContaining({ sessionId: 'session-1', retainUntil: expect.any(Object) }),
    );
  });

  it.each([
    ['revoked', session({ revokedAt: new Date('2026-01-02T00:00:00.000Z') })],
    ['expired', session({ lastUsedAt: new Date('2025-11-01T00:00:00.000Z') })],
  ])('rejects a %s session without mutating it', async (_label, currentSession) => {
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn(),
    };
    const historyRepository = {
      insert: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const { service } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      { findOne: jest.fn() },
    );

    await expect(service.refresh('session-1.old-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessionRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.insert).not.toHaveBeenCalled();
  });

  it('propagates persistence failures so the transaction can roll back all changes', async () => {
    const currentSession = session();
    const sessionRepository = {
      findOne: jest.fn().mockResolvedValue(currentSession),
      save: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const historyRepository = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const { service } = serviceWithTransaction(
      sessionRepository,
      historyRepository,
      { findOne: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }) },
    );

    await expect(service.refresh('session-1.old-secret')).rejects.toThrow(
      'database unavailable',
    );
    expect(historyRepository.insert).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing five-session limit when issuing another session', async () => {
    const activeSessions = Array.from({ length: 5 }, (_, index) => ({
      id: `session-${index}`,
      userId: 'user-1',
      lastUsedAt: new Date(Date.now() - (5 - index) * 60_000),
      revokedAt: null,
    }));
    const sessions = {
      find: jest.fn().mockResolvedValue(activeSessions),
      create: jest.fn((value: Record<string, unknown>) => ({ id: 'new-session', ...value })),
      save: jest.fn(async (value: unknown) => value),
    };
    const jwt = { sign: jest.fn(() => 'access-token') };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_TTL_DAYS') return 30;
        if (key === 'MAX_SESSIONS_PER_USER') return 5;
        return undefined;
      }),
    };
    const service = new AuthService(
      {} as never,
      {} as never,
      sessions as never,
      jwt as never,
      config as never,
      {} as never,
    );

    const result = await service.issueSession(
      { id: 'user-1', email: 'user@example.com' } as never,
      {},
    );

    expect(result.sessionId).toBe('new-session');
    expect(sessions.save.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ id: 'session-0', revokedAt: expect.any(Date) }),
    ]);
    expect(activeSessions.slice(1).every((item) => item.revokedAt === null)).toBe(true);
    expect(sessions.save).toHaveBeenCalledTimes(2);
  });
});
