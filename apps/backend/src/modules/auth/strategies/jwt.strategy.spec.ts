import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

function strategyWithSessionLookup(findOne: jest.Mock) {
  const config = {
    get: jest.fn((key: string) =>
      key === 'JWT_ACCESS_SECRET' ? 'access-secret' : undefined,
    ),
  };
  const sessions = { findOne };

  return Reflect.construct(JwtStrategy, [config, sessions]) as JwtStrategy;
}

describe('JwtStrategy.validate', () => {
  it('rejects an access token without the private sessionId claim', async () => {
    const strategy = strategyWithSessionLookup(jest.fn());

    await expect(
      strategy.validate({ sub: 'user-1', email: 'user@example.com' } as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-string sessionId without querying a session', async () => {
    const findOne = jest.fn();
    const strategy = strategyWithSessionLookup(findOne);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        sessionId: 42,
      } as unknown as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(findOne).not.toHaveBeenCalled();
  });

  it('rejects a session that does not belong to the token subject', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const strategy = strategyWithSessionLookup(findOne);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        sessionId: 'session-2',
      } as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'session-2', userId: 'user-1' },
    });
  });

  it('rejects a revoked session', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const strategy = strategyWithSessionLookup(findOne);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        sessionId: 'session-1',
      } as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns both identities when the session is active and belongs to the user', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
    });
    const strategy = strategyWithSessionLookup(findOne);
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      sessionId: 'session-1',
    };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });
});
