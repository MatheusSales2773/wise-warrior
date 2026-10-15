import { ExecutionContext, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { configureApp, parseTrustProxy } from '../../app.setup';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService, type AuthTokens } from '../../modules/auth/auth.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RejectBrowserOriginGuard } from '../../modules/auth/guards/reject-browser-origin.guard';
import { NativeAuthController } from '../../modules/auth/native-auth.controller';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { SessionsController } from '../../modules/sessions/sessions.controller';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { StudySessionStartService } from '../../modules/sessions/study-session-start.service';
import { StudySessionTransitionService } from '../../modules/sessions/study-session-transition.service';
import { RATE_LIMIT_MESSAGE, RateLimitModule } from './rate-limit';

const tokens: AuthTokens = { accessToken: 'access-token', refreshToken: 'session-id.refresh-secret', sessionId: 'session-id' };
const studySessionId = '00000000-0000-4000-8000-000000000013';

describe('Rate limiting and security headers over HTTP', () => {
  const auth = {
    register: jest.fn(),
    validateCredentials: jest.fn(),
    issueSession: jest.fn(),
    refresh: jest.fn(),
    logoutByRefreshToken: jest.fn(),
  };
  const sessions = { heartbeat: jest.fn() };

  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    auth.register.mockResolvedValue(tokens);
    auth.validateCredentials.mockResolvedValue({ id: 'user-1', email: 'hero@wise.app' });
    auth.issueSession.mockResolvedValue(tokens);
    auth.refresh.mockResolvedValue(tokens);
    auth.logoutByRefreshToken.mockResolvedValue(undefined);
    sessions.heartbeat.mockResolvedValue(undefined);

    // Each test compiles its own module, so the in-memory counters start empty.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            CORS_ORIGIN: 'http://localhost:8081',
            RATE_LIMIT_CREDENTIALS_LIMIT: '3',
            RATE_LIMIT_REFRESH_LIMIT: '2',
            RATE_LIMIT_STUDY_SESSION_LIMIT: '2',
          })],
        }),
        RateLimitModule,
      ],
      controllers: [AuthController, NativeAuthController, SessionsController],
      providers: [
        RejectBrowserOriginGuard,
        { provide: AuthService, useValue: auth },
        { provide: SessionsService, useValue: sessions },
        { provide: StudySessionStartService, useValue: {} },
        { provide: StudySessionTransitionService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          const userId = request.headers['x-test-user-id'];
          if (!userId) throw new UnauthorizedException();
          request.user = { sub: userId, email: `${userId}@wise.app`, sessionId: `session-${userId}` };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });

  afterEach(async () => {
    await app.close();
  });

  function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function heartbeat(userId: string): Promise<Response> {
    return fetch(`${baseUrl}/sessions/${studySessionId}/heartbeat`, {
      method: 'PATCH',
      headers: { 'x-test-user-id': userId },
    });
  }

  const credentials = { email: 'hero@wise.app', password: 'super-secret' };

  it('lets the legitimate attempts through and answers the next login with a RFC 7807 429', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post('/auth/login', credentials)).status).toBe(200);
    }

    const blocked = await post('/auth/login', credentials);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    await expect(blocked.json()).resolves.toEqual(expect.objectContaining({
      status: 429,
      detail: RATE_LIMIT_MESSAGE,
      instance: '/api/v1/auth/login',
    }));
    expect(auth.validateCredentials).toHaveBeenCalledTimes(3);
  });

  it('stops a password brute force before the credentials are checked again', async () => {
    auth.validateCredentials.mockRejectedValue(new UnauthorizedException('Credenciais inválidas'));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post('/auth/login', { ...credentials, password: `guess-${attempt}` })).status).toBe(401);
    }
    expect((await post('/auth/login', { ...credentials, password: 'guess-3' })).status).toBe(429);

    expect(auth.validateCredentials).toHaveBeenCalledTimes(3);
  });

  it('counts invalid payloads too, so malformed requests cannot probe without limit', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await post('/auth/register', { email: 'not-an-email' });
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
    }
    expect((await post('/auth/register', { email: 'not-an-email' })).status).toBe(429);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('keeps a separate counter per route and leaves logout unlimited', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) await post('/auth/login', credentials);
    expect((await post('/auth/login', credentials)).status).toBe(429);

    expect((await post('/auth/native/login', { ...credentials, deviceLabel: 'Wise iOS' })).status).toBe(200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await post('/auth/logout', {})).status).toBe(204);
    }
  });

  it('limits the session refresh with its own budget', async () => {
    const refresh = () => fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: 'ww_refresh=session-id.refresh-secret' } });

    expect((await refresh()).status).toBe(200);
    expect((await refresh()).status).toBe(200);
    expect((await refresh()).status).toBe(429);
  });

  it('counts Study Session mutations per user, so one user does not block another on the same network', async () => {
    expect((await heartbeat('user-a')).status).toBe(204);
    expect((await heartbeat('user-a')).status).toBe(204);
    expect((await heartbeat('user-a')).status).toBe(429);

    expect((await heartbeat('user-b')).status).toBe(204);
    expect(sessions.heartbeat).toHaveBeenCalledTimes(3);
  });

  it('sends the defensive headers from helmet and hides the framework', async () => {
    const response = await post('/auth/login', credentials);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-powered-by')).toBeNull();
  });
});

describe('parseTrustProxy', () => {
  it.each([
    [undefined, undefined],
    ['  ', undefined],
    ['true', true],
    ['false', false],
    ['1', 1],
    ['loopback', 'loopback'],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('maps %p to %p', (raw, expected) => {
    expect(parseTrustProxy(raw)).toEqual(expected);
  });
});
