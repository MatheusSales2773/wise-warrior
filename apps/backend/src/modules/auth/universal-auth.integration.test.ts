import type { INestApplication, LoggerService } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import type { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { configureApp } from '../../app.setup';
import { createDatabaseOptions } from '../../config/database.config';
import { AddSessionRefreshTokenHistory1788458460000 } from '../../migrations/1788458460000-add-session-refresh-token-history';
import { CreateWiseSchema1788458400000 } from '../../migrations/1788458400000-create-wise-schema';
import { AuthModule } from './auth.module';

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

function identifier(name: string): string {
  if (!/^wise_universal_auth_[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected database identifier: ${name}`);
  }
  return `\`${name}\``;
}

describe('Universal authentication security contract', () => {
  jest.setTimeout(30_000);

  const logger = new CapturingLogger();
  const consoleSpies: jest.SpyInstance[] = [];
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL_DAYS: process.env.JWT_REFRESH_TTL_DAYS,
    MAX_SESSIONS_PER_USER: process.env.MAX_SESSIONS_PER_USER,
  };

  let admin: Connection | undefined;
  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;
  let databaseName: string | undefined;
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
    databaseName = `wise_universal_auth_${process.pid}_${Date.now()}`;
    admin = await mysql.createConnection({ host, port, user: username, password });
    await admin.query(`CREATE DATABASE ${identifier(databaseName)}`);

    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:8081';
    process.env.JWT_ACCESS_SECRET = 'integration-access-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL_DAYS = '30';
    process.env.MAX_SESSIONS_PER_USER = '5';

    const databaseOptions = createDatabaseOptions({
      NODE_ENV: 'test',
      DB_HOST: host,
      DB_PORT: port,
      DB_USERNAME: username,
      DB_PASSWORD: password,
      DB_DATABASE: databaseName,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          ...databaseOptions,
          database: databaseName,
          migrations: [
            CreateWiseSchema1788458400000,
            AddSessionRefreshTokenHistory1788458460000,
          ],
          migrationsRun: true,
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    dataSource = app.get(DataSource);
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
        if (admin && databaseName) {
          await admin.query(`DROP DATABASE IF EXISTS ${identifier(databaseName)}`);
        }
      } finally {
        try {
          if (admin) {
            await admin.end();
          }
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
    webResponseBodies.push(await webRegister.text());
    refreshTokens.push(refreshTokenFromCookie(webRegister));

    const webLogin = await post(
      '/auth/login',
      { email: 'web-security@wise.app', password: webPassword },
      { origin: 'http://localhost:8081' },
    );
    expect(webLogin.status).toBe(200);
    webResponseHeaders.push(headersFrom(webLogin));
    webResponseBodies.push(await webLogin.text());
    const webLoginRefresh = refreshTokenFromCookie(webLogin);
    refreshTokens.push(webLoginRefresh);

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
    };
    nativeResponseBodies.push(JSON.stringify(nativeRefreshBody));
    refreshTokens.push(nativeRefreshBody.refreshToken);

    const nativeLogout = await post('/auth/native/logout', {
      refreshToken: nativeRefreshBody.refreshToken,
    });
    expect(nativeLogout.status).toBe(204);
    nativeResponseHeaders.push(headersFrom(nativeLogout));

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
      `SELECT password_hash FROM ${identifier(databaseName!)}.users`,
    )) as Row[];
    const sessionRows = (await dataSource!.query(
      `SELECT refresh_token_hash FROM ${identifier(databaseName!)}.sessions`,
    )) as Row[];
    const historyRows = (await dataSource!.query(
      `SELECT token_hash FROM ${identifier(databaseName!)}.session_refresh_token_history`,
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
});
