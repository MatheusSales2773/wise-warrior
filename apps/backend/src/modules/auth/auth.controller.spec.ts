import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService, AuthTokens } from './auth.service';

const tokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'session-id.refresh-secret',
  sessionId: 'session-id',
};

function response() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

describe('AuthController Web contract', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousRefreshTtl = process.env.JWT_REFRESH_TTL_DAYS;

  afterEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
    process.env.JWT_REFRESH_TTL_DAYS = previousRefreshTtl;
  });

  it('rotates the httpOnly refresh cookie without exposing it in the response body', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_REFRESH_TTL_DAYS = '30';
    const auth = { refresh: jest.fn().mockResolvedValue(tokens) };
    const controller = new AuthController(auth as unknown as AuthService);
    const res = response();

    const body = await controller.refresh(
      { cookies: { ww_refresh: 'session-id.old-secret' } } as unknown as Request,
      res,
    );

    expect(auth.refresh).toHaveBeenCalledWith('session-id.old-secret');
    expect(res.cookie).toHaveBeenCalledWith(
      'ww_refresh',
      tokens.refreshToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      },
    );
    expect(body).toEqual({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('returns access token and session id on login while keeping refresh in the cookie', async () => {
    const auth = {
      validateCredentials: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      }),
      issueSession: jest.fn().mockResolvedValue(tokens),
    };
    const controller = new AuthController(auth as unknown as AuthService);
    const res = response();

    const body = await controller.login(
      {
        email: 'user@example.com',
        password: 'super-secret',
      },
      { headers: { 'user-agent': 'wise-web' } } as unknown as Request,
      res,
    );

    expect(auth.issueSession).toHaveBeenCalledWith(
      { id: 'user-1', email: 'user@example.com' },
      { deviceLabel: 'Wise Web', userAgent: 'wise-web' },
    );
    expect(body).toEqual({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });
    expect(body).not.toHaveProperty('refreshToken');
    expect(res.cookie).toHaveBeenCalledWith(
      'ww_refresh',
      tokens.refreshToken,
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('defaults the Web register label to a predictable non-sensitive value', async () => {
    const auth = {
      register: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      }),
      issueSession: jest.fn().mockResolvedValue(tokens),
    };
    const controller = new AuthController(auth as unknown as AuthService);
    const res = response();

    const body = await controller.register(
      {
        email: 'user@example.com',
        password: 'super-secret',
        displayName: 'Hero',
      },
      { headers: {} } as unknown as Request,
      res,
    );

    expect(auth.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'super-secret',
      displayName: 'Hero',
    });
    expect(auth.issueSession).toHaveBeenCalledWith(
      { id: 'user-1', email: 'user@example.com' },
      { deviceLabel: 'Wise Web', userAgent: undefined },
    );
    expect(body).toEqual({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('revokes the presented Web credential and clears the scoped cookie on logout', async () => {
    const auth = { logoutByRefreshToken: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(auth as unknown as AuthService);
    const res = response();

    await expect(
      controller.logout(
        { cookies: { ww_refresh: 'session-id.refresh-secret' } } as unknown as Request,
        res,
      ),
    ).resolves.toBeUndefined();

    expect(auth.logoutByRefreshToken).toHaveBeenCalledWith(
      'session-id.refresh-secret',
    );
    expect(res.clearCookie).toHaveBeenCalledWith('ww_refresh', {
      path: '/api/v1/auth',
    });
  });
});
