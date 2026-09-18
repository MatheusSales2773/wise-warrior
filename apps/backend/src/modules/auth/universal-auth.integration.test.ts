import type { INestApplication, LoggerService } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { RowDataPacket } from 'mysql2/promise';
import type { AddressInfo } from 'node:net';
import type { Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { createIntegrationDatabase, type IntegrationDatabase } from '../../test/integration-database';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Row = RowDataPacket & Record<string, unknown>;

class CapturingLogger implements LoggerService {
  readonly entries: string[] = [];

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.capture(message, optionalParams);
  }

  private capture(message: unknown, optionalParams: unknown[]): void {
    this.entries.push(
      JSON.stringify([message, ...optionalParams], (_key, value: unknown) =>
        value instanceof Error
          ? { name: value.name, message: value.message, stack: value.stack }
          : value,
      ),
    );
  }
}

describe('Universal authentication security contract', () => {
  jest.setTimeout(30_000);

  const logger = new CapturingLogger();
  const consoleSpies: jest.SpyInstance[] = [];
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_MIGRATIONS_RUN: process.env.DB_MIGRATIONS_RUN,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL_DAYS: process.env.JWT_REFRESH_TTL_DAYS,
    MAX_SESSIONS_PER_USER: process.env.MAX_SESSIONS_PER_USER,
  };

  let database: IntegrationDatabase | undefined;
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    for (const method of [
      'log',
      'error',
      'warn',
      'debug',
      'info',
      'trace',
    ] as const) {
      consoleSpies.push(
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
    }

    const host = process.env.TEST_DB_HOST ?? 'localhost';
    const port = Number(process.env.TEST_DB_PORT ?? 3306);
    const username = process.env.TEST_DB_ADMIN_USERNAME ?? 'root';
    const password = process.env.TEST_DB_ADMIN_PASSWORD ?? 'change-me-root';
    database = await createIntegrationDatabase('wise_universal_auth');

    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:8081';
    process.env.DB_HOST = host;
    process.env.DB_PORT = String(port);
    process.env.DB_USERNAME = username;
    process.env.DB_PASSWORD = password;
    process.env.DB_DATABASE = database.name;
    process.env.DB_MIGRATIONS_RUN = 'false';
    process.env.JWT_ACCESS_SECRET = 'integration-access-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL_DAYS = '30';
    process.env.MAX_SESSIONS_PER_USER = '5';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger });
    configureApp(app);
    await app.init();
    const initializedDataSource = app.get(DataSource);
    dataSource = initializedDataSource;
    await initializedDataSource.runMigrations();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      try {
        await database?.close();
      } finally {
        for (const [key, value] of Object.entries(previousEnvironment)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
        for (const spy of consoleSpies) {
          spy.mockRestore();
        }
      }
    }
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

  function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { headers });
  }

  function remove(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
  }

  function refreshTokenFromCookie(response: Response): string {
    const cookie = response.headers.get('set-cookie') ?? '';
    const match = /ww_refresh=([^;]+)/.exec(cookie);
    if (!match?.[1]) {
      throw new Error('Response did not set the refresh cookie');
    }
    return match[1];
  }

  function headersFrom(response: Response): Array<[string, string]> {
    const headers: Array<[string, string]> = [];
    response.headers.forEach((value, name) => headers.push([name, value]));
    return headers;
  }

  function accessClaims(accessToken: string): Record<string, unknown> {
    const decoded = app!.get(JwtService).decode(accessToken);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Access token did not decode to an object');
    }
    return decoded as Record<string, unknown>;
  }

  function signAccessToken(payload: Record<string, unknown>): string {
    return app!.get(JwtService).sign(payload, {
      secret: 'integration-access-secret',
      expiresIn: '15m',
    });
  }

  it('keeps plaintext passwords and refresh credentials out of Web responses, logs and MySQL', async () => {
    const webPassword = 'web-password-secret';
    const nativePassword = 'native-password-secret';
    const webResponseBodies: string[] = [];
    const nativeResponseBodies: string[] = [];
    const webResponseHeaders: Array<Array<[string, string]>> = [];
    const nativeResponseHeaders: Array<Array<[string, string]>> = [];
    const refreshTokens: string[] = [];

    const webRegister = await post(
      '/auth/register',
      {
        email: 'web-security@wise.app',
        password: webPassword,
        displayName: 'Web Security',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(webRegister.status).toBe(201);
    webResponseHeaders.push(headersFrom(webRegister));
    const webRegisterText = await webRegister.text();
    webResponseBodies.push(webRegisterText);
    const webRegisterBody = JSON.parse(webRegisterText) as {
      sessionId: string;
      refreshToken?: string;
    };
    expect(webRegisterBody).toEqual({
      accessToken: expect.any(String),
      sessionId: expect.any(String),
    });
    expect(webRegisterBody).not.toHaveProperty('refreshToken');
    refreshTokens.push(refreshTokenFromCookie(webRegister));

    const webLogin = await post(
      '/auth/login',
      { email: 'web-security@wise.app', password: webPassword },
      { origin: 'http://localhost:8081' },
    );
    expect(webLogin.status).toBe(200);
    webResponseHeaders.push(headersFrom(webLogin));
    const webLoginText = await webLogin.text();
    webResponseBodies.push(webLoginText);
    const webLoginBody = JSON.parse(webLoginText) as {
      sessionId: string;
      refreshToken?: string;
    };
    expect(webLoginBody.sessionId).not.toBe(webRegisterBody.sessionId);
    expect(webLoginBody).not.toHaveProperty('refreshToken');
    const webLoginRefresh = refreshTokenFromCookie(webLogin);
    refreshTokens.push(webLoginRefresh);

    const registeredUserRows = (await dataSource!.query(
      `SELECT id, email, display_name FROM ${database!.identifier}.users
       WHERE email = ?`,
      ['web-security@wise.app'],
    )) as Row[];
    expect(registeredUserRows).toHaveLength(1);
    const registeredUserId = String(registeredUserRows[0]!.id);
    expect(registeredUserRows[0]).toEqual(
      expect.objectContaining({
        email: 'web-security@wise.app',
        display_name: 'Web Security',
      }),
    );

    const characterRows = (await dataSource!.query(
      `SELECT user_id, level, xp_total FROM ${database!.identifier}.characters
       WHERE user_id = ?`,
      [registeredUserId],
    )) as Row[];
    expect(characterRows).toHaveLength(1);
    expect(characterRows[0]).toEqual(
      expect.objectContaining({ user_id: registeredUserId, level: 1 }),
    );
    expect(Number(characterRows[0]!.xp_total)).toBe(0);

    const registeredSessionRows = (await dataSource!.query(
      `SELECT id, revoked_at FROM ${database!.identifier}.sessions
       WHERE user_id = ? ORDER BY created_at ASC`,
      [registeredUserId],
    )) as Row[];
    expect(registeredSessionRows).toHaveLength(2);
    expect(registeredSessionRows.map((row) => String(row.id))).toEqual(
      expect.arrayContaining([webRegisterBody.sessionId, webLoginBody.sessionId]),
    );
    expect(registeredSessionRows.every((row) => row.revoked_at === null)).toBe(true);

    const webRefresh = await post(
      '/auth/refresh',
      {},
      {
        origin: 'http://localhost:8081',
        cookie: `ww_refresh=${webLoginRefresh}`,
      },
    );
    expect(webRefresh.status).toBe(200);
    webResponseHeaders.push(headersFrom(webRefresh));
    webResponseBodies.push(await webRefresh.text());
    const rotatedWebRefresh = refreshTokenFromCookie(webRefresh);
    refreshTokens.push(rotatedWebRefresh);

    const webLogout = await post(
      '/auth/logout',
      {},
      {
        origin: 'http://localhost:8081',
        cookie: `ww_refresh=${rotatedWebRefresh}`,
      },
    );
    expect(webLogout.status).toBe(204);
    webResponseHeaders.push(headersFrom(webLogout));
    const webLogoutReplay = await post(
      '/auth/refresh',
      {},
      {
        origin: 'http://localhost:8081',
        cookie: `ww_refresh=${rotatedWebRefresh}`,
      },
    );
    expect(webLogoutReplay.status).toBe(401);
    const webRevokedRows = (await dataSource!.query(
      `SELECT revoked_at FROM ${database!.identifier}.sessions WHERE id = ?`,
      [webLoginBody.sessionId],
    )) as Row[];
    expect(webRevokedRows).toHaveLength(1);
    expect(webRevokedRows[0]!.revoked_at).not.toBeNull();

    const nativeRegister = await post('/auth/native/register', {
      email: 'native-security@wise.app',
      password: nativePassword,
      displayName: 'Native Security',
      deviceLabel: 'Wise iOS',
    });
    expect(nativeRegister.status).toBe(201);
    nativeResponseHeaders.push(headersFrom(nativeRegister));
    const nativeRegisterBody = (await nativeRegister.json()) as {
      refreshToken: string;
      sessionId: string;
    };
    nativeResponseBodies.push(JSON.stringify(nativeRegisterBody));
    refreshTokens.push(nativeRegisterBody.refreshToken);

    const nativeLogin = await post('/auth/native/login', {
      email: 'native-security@wise.app',
      password: nativePassword,
      deviceLabel: 'Wise Android',
    });
    expect(nativeLogin.status).toBe(200);
    nativeResponseHeaders.push(headersFrom(nativeLogin));
    const nativeLoginBody = (await nativeLogin.json()) as {
      refreshToken: string;
      sessionId: string;
    };
    nativeResponseBodies.push(JSON.stringify(nativeLoginBody));
    refreshTokens.push(nativeLoginBody.refreshToken);

    const nativeRefresh = await post('/auth/native/refresh', {
      refreshToken: nativeLoginBody.refreshToken,
    });
    expect(nativeRefresh.status).toBe(200);
    nativeResponseHeaders.push(headersFrom(nativeRefresh));
    const nativeRefreshBody = (await nativeRefresh.json()) as {
      refreshToken: string;
      sessionId: string;
    };
    nativeResponseBodies.push(JSON.stringify(nativeRefreshBody));
    refreshTokens.push(nativeRefreshBody.refreshToken);

    const nativeLogout = await post('/auth/native/logout', {
      refreshToken: nativeRefreshBody.refreshToken,
    });
    expect(nativeLogout.status).toBe(204);
    nativeResponseHeaders.push(headersFrom(nativeLogout));
    const nativeLogoutReplay = await post('/auth/native/refresh', {
      refreshToken: nativeRefreshBody.refreshToken,
    });
    expect(nativeLogoutReplay.status).toBe(401);
    const nativeRevokedRows = (await dataSource!.query(
      `SELECT revoked_at FROM ${database!.identifier}.sessions WHERE id = ?`,
      [nativeRefreshBody.sessionId],
    )) as Row[];
    expect(nativeRevokedRows).toHaveLength(1);
    expect(nativeRevokedRows[0]!.revoked_at).not.toBeNull();

    const serializedWebResponses = webResponseBodies.join('\n');
    const serializedResponses = [
      ...webResponseBodies,
      ...nativeResponseBodies,
    ].join('\n');
    expect(serializedWebResponses).not.toContain('refreshToken');
    expect(serializedResponses).not.toContain(webPassword);
    expect(serializedResponses).not.toContain(nativePassword);
    const serializedHeaders = JSON.stringify([
      ...webResponseHeaders,
      ...nativeResponseHeaders,
    ]);
    expect(serializedHeaders).not.toContain(webPassword);
    expect(serializedHeaders).not.toContain(nativePassword);
    const unauthorizedRefreshHeaders = JSON.stringify([
      ...webResponseHeaders.map((headers) =>
        headers.filter(([name]) => name !== 'set-cookie'),
      ),
      ...nativeResponseHeaders,
    ]);

    const persistedRows = (await dataSource!.query(
      `SELECT password_hash FROM ${database!.identifier}.users`,
    )) as Row[];
    const sessionRows = (await dataSource!.query(
      `SELECT refresh_token_hash FROM ${database!.identifier}.sessions`,
    )) as Row[];
    const historyRows = (await dataSource!.query(
      `SELECT token_hash FROM ${database!.identifier}.session_refresh_token_history`,
    )) as Row[];
    const serializedPersistence = JSON.stringify([
      ...persistedRows,
      ...sessionRows,
      ...historyRows,
    ]);
    const serializedLogs = [
      logger.entries.join('\n'),
      JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls)),
    ].join('\n');

    const refreshCredentials = [
      ...refreshTokens,
      ...refreshTokens.map((token) => token.split('.')[1]!),
    ];
    for (const plaintext of [
      webPassword,
      nativePassword,
      ...refreshCredentials,
    ]) {
      expect(serializedPersistence).not.toContain(plaintext);
      expect(serializedLogs).not.toContain(plaintext);
    }
    for (const refreshCredential of refreshCredentials) {
      expect(serializedWebResponses).not.toContain(refreshCredential);
      expect(unauthorizedRefreshHeaders).not.toContain(refreshCredential);
    }
    expect(persistedRows).toHaveLength(2);
    expect(
      persistedRows.every((row) =>
        String(row.password_hash).startsWith('$argon2id$'),
      ),
    ).toBe(true);
  });

  it('returns numeric progression boundaries from the authenticated profile endpoint', async () => {
    const registration = await post(
      '/auth/register',
      {
        email: 'profile-projection@wise.app',
        password: 'profile-password-secret',
        displayName: 'Profile Projection',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      accessToken: string;
    };

    const profileResponse = await get('/users/me', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin: 'http://localhost:8081',
    });
    expect(profileResponse.status).toBe(200);
    const profile = (await profileResponse.json()) as Record<string, unknown>;

    expect(profile).toEqual(
      expect.objectContaining({
        level: 1,
        xpTotal: 0,
        levelStartXp: 0,
        nextLevelXp: 1_414,
      }),
    );
    expect(typeof profile.levelStartXp).toBe('number');
    expect(typeof profile.nextLevelXp).toBe('number');
    expect(typeof profile.xpTotal).toBe('number');
  });

  it('preserves the profile contract for a legacy account without a Character', async () => {
    const registration = await post(
      '/auth/register',
      {
        email: 'legacy-profile@wise.app',
        password: 'legacy-password-secret',
        displayName: 'Legacy Profile',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      accessToken: string;
    };

    const userRows = (await dataSource!.query(
      `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
      ['legacy-profile@wise.app'],
    )) as Row[];
    expect(userRows).toHaveLength(1);
    await dataSource!.query(
      `DELETE FROM ${database!.identifier}.characters WHERE user_id = ?`,
      [String(userRows[0]!.id)],
    );

    const profileResponse = await get('/users/me', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin: 'http://localhost:8081',
    });
    expect(profileResponse.status).toBe(200);
    const profile = (await profileResponse.json()) as Record<string, unknown>;

    expect(profile).toEqual(
      expect.objectContaining({
        id: String(userRows[0]!.id),
        email: 'legacy-profile@wise.app',
        displayName: 'Legacy Profile',
        planTier: 'free',
        level: 1,
        xpTotal: 0,
        levelStartXp: 0,
        nextLevelXp: 1_414,
        title: null,
      }),
    );
    expect(typeof profile.level).toBe('number');
    expect(typeof profile.xpTotal).toBe('number');
    expect(typeof profile.levelStartXp).toBe('number');
    expect(typeof profile.nextLevelXp).toBe('number');
  });

  it('returns a safe HTTP failure when persisted character level diverges from XP', async () => {
    const xpTotal = 1_501;
    const registration = await post(
      '/auth/register',
      {
        email: 'inconsistent-profile@wise.app',
        password: 'inconsistent-profile-password',
        displayName: 'Inconsistent Profile',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      accessToken: string;
    };
    const userRows = (await dataSource!.query(
      `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
      ['inconsistent-profile@wise.app'],
    )) as Row[];
    expect(userRows).toHaveLength(1);

    await dataSource!.query(
      `UPDATE ${database!.identifier}.characters
       SET level = ?, xp_total = ?
       WHERE user_id = ?`,
      [3, xpTotal, String(userRows[0]!.id)],
    );

    const profileResponse = await get('/users/me', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin: 'http://localhost:8081',
    });
    expect(profileResponse.status).toBe(500);
    expect(profileResponse.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    const profile = (await profileResponse.json()) as Record<string, unknown>;

    expect(profile).toEqual({
      type: 'https://wise.app/errors/500',
      title: 'InternalServerError',
      status: 500,
      detail: 'Erro interno inesperado',
      instance: '/api/v1/users/me',
    });
    expect(JSON.stringify(profile)).not.toContain(String(xpTotal));
    expect(JSON.stringify(profile)).not.toContain(
      'nível persistido inconsistente com xpTotal',
    );
  });

  it('propagates and enforces Session identity through the real authentication contract', async () => {
    const origin = 'http://localhost:8081';
    const userA = {
      email: `session-identity-a-${process.pid}@wise.app`,
      password: 'session-identity-password',
      displayName: 'Session Identity A',
    };
    const userB = {
      email: `session-identity-b-${process.pid}@wise.app`,
      password: 'session-identity-password',
      displayName: 'Session Identity B',
    };

    const registration = await post('/auth/register', userA, { origin });
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      accessToken: string;
      sessionId: string;
    };
    const registrationClaims = accessClaims(registrationBody.accessToken);
    const userRows = (await dataSource!.query(
      `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
      [userA.email],
    )) as Row[];
    expect(userRows).toHaveLength(1);
    const userAId = String(userRows[0]!.id);
    expect(registrationClaims).toEqual(
      expect.objectContaining({
        sub: userAId,
        email: userA.email,
        sessionId: registrationBody.sessionId,
      }),
    );

    const login = await post(
      '/auth/login',
      { email: userA.email, password: userA.password },
      { origin },
    );
    expect(login.status).toBe(200);
    const loginBody = (await login.json()) as {
      accessToken: string;
      sessionId: string;
    };
    expect(loginBody.sessionId).not.toBe(registrationBody.sessionId);
    expect(accessClaims(loginBody.accessToken)).toEqual(
      expect.objectContaining({
        sub: userAId,
        email: userA.email,
        sessionId: loginBody.sessionId,
      }),
    );

    const loginRefreshToken = refreshTokenFromCookie(login);
    const refresh = await post(
      '/auth/refresh',
      {},
      { origin, cookie: `ww_refresh=${loginRefreshToken}` },
    );
    expect(refresh.status).toBe(200);
    const refreshBody = (await refresh.json()) as {
      accessToken: string;
      sessionId: string;
    };
    expect(refreshBody.sessionId).toBe(loginBody.sessionId);
    expect(accessClaims(refreshBody.accessToken)).toEqual(
      expect.objectContaining({
        sub: userAId,
        email: userA.email,
        sessionId: loginBody.sessionId,
      }),
    );
    await expect(
      get('/users/me', {
        authorization: `Bearer ${refreshBody.accessToken}`,
        origin,
      }),
    ).resolves.toHaveProperty('status', 200);

    const realtime = app!.get(RealtimeGateway);
    const activeSocket = {
      data: {},
      disconnect: jest.fn(),
      handshake: { auth: { token: refreshBody.accessToken }, query: {} },
      join: jest.fn(),
    } as unknown as Socket;
    await realtime.handleConnection(activeSocket);
    expect(activeSocket.join).toHaveBeenCalledWith(`user:${userAId}`);
    expect(activeSocket.data.sessionId).toBe(loginBody.sessionId);
    expect(activeSocket.disconnect).not.toHaveBeenCalled();

    const registrationB = await post('/auth/register', userB, { origin });
    expect(registrationB.status).toBe(201);
    const registrationBBody = (await registrationB.json()) as {
      accessToken: string;
      sessionId: string;
    };
    const registrationBClaims = accessClaims(registrationBBody.accessToken);
    expect(registrationBClaims.sessionId).toBe(registrationBBody.sessionId);
    expect(registrationBClaims.sub).not.toBe(userAId);

    const legacyToken = signAccessToken({ sub: userAId, email: userA.email });
    const legacyResponse = await get('/users/me', {
      authorization: `Bearer ${legacyToken}`,
      origin,
    });
    expect(legacyResponse.status).toBe(401);

    const crossedSessionToken = signAccessToken({
      sub: userAId,
      email: userA.email,
      sessionId: registrationBBody.sessionId,
    });
    const crossedSessionResponse = await get('/users/me', {
      authorization: `Bearer ${crossedSessionToken}`,
      'x-session-id': registrationBBody.sessionId,
      origin,
    });
    expect(crossedSessionResponse.status).toBe(401);

    const revokeLogin = await remove(
      `/users/me/sessions/${loginBody.sessionId}`,
      { authorization: `Bearer ${registrationBody.accessToken}`, origin },
    );
    expect(revokeLogin.status).toBe(204);
    const revokedAccessResponse = await get('/users/me', {
      authorization: `Bearer ${loginBody.accessToken}`,
      origin,
    });
    expect(revokedAccessResponse.status).toBe(401);
    const revokedSocket = {
      data: {},
      disconnect: jest.fn(),
      handshake: { auth: { token: loginBody.accessToken }, query: {} },
      join: jest.fn(),
    } as unknown as Socket;
    await realtime.handleConnection(revokedSocket);
    expect(revokedSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(revokedSocket.join).not.toHaveBeenCalled();
    const registrationStillActive = await get('/users/me', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin,
    });
    expect(registrationStillActive.status).toBe(200);

    const revokeAll = await remove('/users/me/sessions', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin,
    });
    expect(revokeAll.status).toBe(204);
    const revokedAllResponse = await get('/users/me', {
      authorization: `Bearer ${registrationBody.accessToken}`,
      origin,
    });
    expect(revokedAllResponse.status).toBe(401);
    const userBStillActive = await get('/users/me', {
      authorization: `Bearer ${registrationBBody.accessToken}`,
      origin,
    });
    expect(userBStillActive.status).toBe(200);

    const revokedRefresh = await post(
      '/auth/refresh',
      {},
      { origin, cookie: `ww_refresh=${loginRefreshToken}` },
    );
    expect(revokedRefresh.status).toBe(401);
  });

  it('enforces the five-session limit across concurrent Web and native logins', async () => {
    const email = `session-limit-${process.pid}@wise.app`;
    const password = 'session-limit-password';
    const registration = await post(
      '/auth/register',
      { email, password, displayName: 'Session Limit' },
      { origin: 'http://localhost:8081' },
    );
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as { sessionId: string };

    const loginResponses = await Promise.all([
      post(
        '/auth/login',
        { email, password, deviceLabel: 'Wise Web' },
        { origin: 'http://localhost:8081' },
      ),
      post(
        '/auth/login',
        { email, password, deviceLabel: 'Wise Web' },
        { origin: 'http://localhost:8081' },
      ),
      post(
        '/auth/login',
        { email, password, deviceLabel: 'Wise Web' },
        { origin: 'http://localhost:8081' },
      ),
      post('/auth/native/login', { email, password, deviceLabel: 'Wise iOS' }),
      post('/auth/native/login', { email, password, deviceLabel: 'Wise Android' }),
      post('/auth/native/login', { email, password, deviceLabel: 'Wise iOS' }),
    ]);
    expect(loginResponses.every((response) => response.status === 200)).toBe(true);

    const userRows = (await dataSource!.query(
      `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
      [email],
    )) as Row[];
    expect(userRows).toHaveLength(1);
    const sessionRows = (await dataSource!.query(
      `SELECT id, revoked_at FROM ${database!.identifier}.sessions
       WHERE user_id = ? ORDER BY created_at ASC`,
      [String(userRows[0]!.id)],
    )) as Row[];
    const activeSessions = sessionRows.filter((row) => row.revoked_at === null);
    expect(sessionRows).toHaveLength(7);
    expect(activeSessions).toHaveLength(5);
    expect(activeSessions.length).toBeLessThanOrEqual(5);
    expect(sessionRows.find((row) => row.id === registrationBody.sessionId)?.revoked_at).not.toBeNull();
  });

  it('returns distinct conflict and backend-validation responses for registration', async () => {
    const fixtureEmail = 'registration-errors@wise.app';
    const fixture = await post(
      '/auth/register',
      {
        email: fixtureEmail,
        password: 'fixture-password',
        displayName: 'Registration Fixture',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(fixture.status).toBe(201);

    const duplicateWeb = await post(
      '/auth/register',
      {
        email: fixtureEmail,
        password: 'another-password',
        displayName: 'Another Web',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(duplicateWeb.status).toBe(409);

    const invalidWeb = await post(
      '/auth/register',
      {
        email: 'invalid-web@wise.app',
        password: 'short',
        displayName: 'Invalid Web',
      },
      { origin: 'http://localhost:8081' },
    );
    expect(invalidWeb.status).toBe(400);

    const nativeFixtureEmail = 'registration-native-errors@wise.app';
    const nativeFixture = await post('/auth/native/register', {
      email: nativeFixtureEmail,
      password: 'fixture-password',
      displayName: 'Native Registration Fixture',
      deviceLabel: 'Wise Android',
    });
    expect(nativeFixture.status).toBe(201);

    const duplicateNative = await post('/auth/native/register', {
      email: nativeFixtureEmail,
      password: 'another-password',
      displayName: 'Another Native',
      deviceLabel: 'Wise Android',
    });
    expect(duplicateNative.status).toBe(409);

    const invalidNative = await post('/auth/native/register', {
      email: 'invalid-native@wise.app',
      password: 'short',
      displayName: 'Invalid Native',
      deviceLabel: 'Wise Android',
    });
    expect(invalidNative.status).toBe(400);
  });

  it('maps concurrent registration races to one success and one conflict', async () => {
    const email = 'registration-race@wise.app';
    const responses = await Promise.all([
      post(
        '/auth/register',
        { email, password: 'race-password-1', displayName: 'Race One' },
        { origin: 'http://localhost:8081' },
      ),
      post(
        '/auth/register',
        { email, password: 'race-password-2', displayName: 'Race Two' },
        { origin: 'http://localhost:8081' },
      ),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const userRows = (await dataSource!.query(
      `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
      [email],
    )) as Row[];
    expect(userRows).toHaveLength(1);
    const characterRows = (await dataSource!.query(
      `SELECT characters.id
       FROM ${database!.identifier}.characters AS characters
       INNER JOIN ${database!.identifier}.users AS users
         ON users.id = characters.user_id
       WHERE users.email = ?`,
      [email],
    )) as Row[];
    const sessionRows = (await dataSource!.query(
      `SELECT sessions.id
       FROM ${database!.identifier}.sessions AS sessions
       INNER JOIN ${database!.identifier}.users AS users
         ON users.id = sessions.user_id
       WHERE users.email = ?`,
      [email],
    )) as Row[];
    expect(characterRows).toHaveLength(1);
    expect(sessionRows).toHaveLength(1);
  });

  it('rolls back User, Character and Session when character persistence fails', async () => {
    const email = 'registration-rollback@wise.app';
    const triggerName = `wise_registration_fail_${process.pid}`;
    await dataSource!.query(
      `CREATE TRIGGER \`${triggerName}\`
       BEFORE INSERT ON ${database!.identifier}.characters
       FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced registration failure'`,
    );

    try {
      const response = await post(
        '/auth/register',
        { email, password: 'rollback-password', displayName: 'Rollback' },
        { origin: 'http://localhost:8081' },
      );
      expect(response.status).toBe(500);

      const userRows = (await dataSource!.query(
        `SELECT id FROM ${database!.identifier}.users WHERE email = ?`,
        [email],
      )) as Row[];
      const characterRows = (await dataSource!.query(
        `SELECT characters.id
         FROM ${database!.identifier}.characters AS characters
         INNER JOIN ${database!.identifier}.users AS users
           ON users.id = characters.user_id
         WHERE users.email = ?`,
        [email],
      )) as Row[];
      const sessionRows = (await dataSource!.query(
        `SELECT sessions.id
         FROM ${database!.identifier}.sessions AS sessions
         INNER JOIN ${database!.identifier}.users AS users
           ON users.id = sessions.user_id
         WHERE users.email = ?`,
        [email],
      )) as Row[];
      expect(userRows).toHaveLength(0);
      expect(characterRows).toHaveLength(0);
      expect(sessionRows).toHaveLength(0);
    } finally {
      await dataSource!.query(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
    }
  });
});
