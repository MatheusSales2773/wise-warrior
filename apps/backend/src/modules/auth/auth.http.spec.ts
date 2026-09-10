import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { configureApp } from '../../app.setup';
import { AuthController } from './auth.controller';
import { NativeAuthController } from './native-auth.controller';
import { RejectBrowserOriginGuard } from './guards/reject-browser-origin.guard';
import { AuthService } from './auth.service';
import type { AuthTokens } from './auth.service';

const tokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'session-id.refresh-secret',
  sessionId: 'session-id',
};

const allowedOrigin = 'http://localhost:8081';

describe('Auth HTTP transport contract', () => {
  const auth = {
    register: jest.fn(),
    validateCredentials: jest.fn(),
    issueSession: jest.fn(),
    refresh: jest.fn(),
    logoutByRefreshToken: jest.fn(),
  };

  let app: INestApplication;
  let baseUrl: string;
  let previousCorsOrigin: string | undefined;

  beforeAll(async () => {
    previousCorsOrigin = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = `${allowedOrigin},https://app.example.com`;
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [AuthController, NativeAuthController],
      providers: [
        RejectBrowserOriginGuard,
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app.close();
    if (previousCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previousCorsOrigin;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.register.mockResolvedValue({ id: 'user-1', email: 'hero@wise.app' });
    auth.validateCredentials.mockResolvedValue({
      id: 'user-1',
      email: 'hero@wise.app',
    });
    auth.issueSession.mockResolvedValue(tokens);
    auth.refresh.mockResolvedValue(tokens);
    auth.logoutByRefreshToken.mockResolvedValue(undefined);
  });

  function post(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('keeps the Web refresh credential in an httpOnly cookie and returns the session id', async () => {
    const response = await post(
      '/auth/login',
      { email: 'hero@wise.app', password: 'super-secret' },
      { origin: allowedOrigin },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('ww_refresh=session-id.refresh-secret');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('SameSite=Lax');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });
    expect(text).not.toContain('refresh-secret');
    expect(text).not.toContain('super-secret');
  });

  it('rotates the Web cookie on refresh and still returns the session id', async () => {
    const response = await post(
      '/auth/refresh',
      {},
      {
        origin: allowedOrigin,
        cookie: 'ww_refresh=session-id.old-secret',
      },
    );

    expect(response.status).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith('session-id.old-secret');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });
    expect(text).not.toContain('refresh-secret');
    expect(text).not.toContain('super-secret');
  });

  it('delivers the rotating credential by body only on native endpoints', async () => {
    const response = await post('/auth/native/register', {
      email: 'hero@wise.app',
      password: 'super-secret',
      displayName: 'Hero',
      deviceLabel: 'Wise iOS',
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(auth.issueSession).toHaveBeenCalledWith(
      { id: 'user-1', email: 'hero@wise.app' },
      expect.objectContaining({
        deviceLabel: 'Wise iOS',
        userAgent: expect.any(String),
      }),
    );
    const account = await response.json();
    expect(account).toEqual(tokens);
    expect(account).toHaveProperty('refreshToken');
    expect(JSON.stringify(account)).not.toContain('super-secret');
  });

  it('rotates and revokes native sessions with body credentials', async () => {
    const refresh = await post('/auth/native/refresh', {
      refreshToken: 'session-id.old-secret',
    });
    expect(refresh.status).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith('session-id.old-secret');
    await expect(refresh.json()).resolves.toEqual(tokens);

    const logout = await post('/auth/native/logout', {
      refreshToken: 'session-id.new-secret',
    });
    expect(logout.status).toBe(204);
    expect(auth.logoutByRefreshToken).toHaveBeenCalledWith('session-id.new-secret');
  });

  it.each([
    ['an allowlisted Web origin', allowedOrigin],
    ['the opaque null origin', 'null'],
  ])('rejects a native request carrying %s before touching credentials', async (
    _label,
    origin,
  ) => {
    const response = await post(
      '/auth/native/login',
      {
        email: 'hero@wise.app',
        password: 'super-secret',
        deviceLabel: 'Wise Android',
      },
      { origin },
    );

    expect(response.status).toBe(403);
    expect(auth.validateCredentials).not.toHaveBeenCalled();
    const text = await response.text();
    expect(text).not.toContain('super-secret');
    expect(text).not.toContain('refresh');
  });

  it('does not grant preflight to native endpoints', async () => {
    const response = await fetch(`${baseUrl}/auth/native/login`, {
      method: 'OPTIONS',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers the configured Web preflight with credentials', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('never reflects an origin outside the allowlist', async () => {
    const response = await post(
      '/auth/login',
      { email: 'hero@wise.app', password: 'super-secret' },
      { origin: 'https://evil.example' },
    );

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
