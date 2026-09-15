import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createConnection } from 'node:net';
import type { AddressInfo } from 'node:net';
import { configureApp } from '../../app.setup';
import { RealtimeGateway } from './realtime.gateway';

describe('Realtime HTTP transport contract', () => {
  const allowedOrigins = [
    'http://localhost:8081',
    'https://app.example.com',
  ];

  let app: INestApplication;
  let baseUrl: string;
  let previousCorsOrigin: string | undefined;

  beforeAll(async () => {
    previousCorsOrigin = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ CORS_ORIGIN: allowedOrigins.join(',') })],
        }),
      ],
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      if (previousCorsOrigin === undefined) {
        delete process.env.CORS_ORIGIN;
      } else {
        process.env.CORS_ORIGIN = previousCorsOrigin;
      }
    }
  });

  it.each(allowedOrigins)(
    'allows Socket.IO polling from configured origin %s',
    async (origin) => {
      const response = await fetch(
        `${baseUrl}/socket.io/?EIO=4&transport=polling`,
        { headers: { origin } },
      );

      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true',
      );
    },
  );

  it('does not allow Socket.IO polling from an origin outside the allowlist', async () => {
    const response = await fetch(
      `${baseUrl}/socket.io/?EIO=4&transport=polling`,
      { headers: { origin: 'https://evil.example' } },
    );

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('upgrades a WebSocket handshake from a configured origin', async () => {
    await expect(webSocketHandshakeStatus(allowedOrigins[1]!)).resolves.toBe(
      101,
    );
  });

  it('rejects a WebSocket handshake from an origin outside the allowlist', async () => {
    await expect(
      webSocketHandshakeStatus('https://evil.example'),
    ).resolves.not.toBe(101);
  });

  function webSocketHandshakeStatus(origin: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl);
      const socket = createConnection({
        host: url.hostname,
        port: Number(url.port),
      });
      let response = '';

      socket.setTimeout(5_000);
      socket.on('connect', () => {
        socket.write(
          [
            'GET /socket.io/?EIO=4&transport=websocket HTTP/1.1',
            `Host: ${url.host}`,
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
            'Sec-WebSocket-Version: 13',
            `Origin: ${origin}`,
            '',
            '',
          ].join('\r\n'),
        );
      });
      socket.on('data', (chunk) => {
        response += chunk.toString();
        const statusLine = response.split('\r\n')[0] ?? '';
        const match = /^HTTP\/1\.1 (\d{3})/.exec(statusLine);
        if (match?.[1]) {
          socket.destroy();
          resolve(Number(match[1]));
        }
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('WebSocket handshake timed out'));
      });
      socket.on('error', reject);
    });
  }
});
