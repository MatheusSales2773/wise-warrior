import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Application } from 'express';
import helmet from 'helmet';
import { CorsIoAdapter } from './config/cors-io.adapter';
import {
  createCorsOptionsDelegate,
  parseCorsOrigins,
  rejectNativePreflight,
} from './config/cors.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

/**
 * `TRUST_PROXY` vira o `trust proxy` do Express, para `req.ip` (chave do rate limiting) ser o IP do
 * cliente atrás do nginx, e não o do proxy: um número de saltos, `true`/`false` ou uma lista como
 * `loopback`. Ausente, o Express não confia em proxy nenhum.
 */
export function parseTrustProxy(raw: string | undefined): boolean | number | string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Configuração compartilhada entre o bootstrap real e os testes de contrato
 * HTTP: headers de segurança, proxy confiável, cookies, CORS consciente do path, validação, formato
 * Problem e prefixo.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN');

  const trustProxy = parseTrustProxy(config.get<string>('TRUST_PROXY'));
  if (trustProxy !== undefined) {
    (app.getHttpAdapter().getInstance() as Application).set('trust proxy', trustProxy);
  }
  // Antes de qualquer outro middleware, para valer também nas respostas de CORS e de erro.
  app.use(helmet());
  app.use(cookieParser());
  app.use(rejectNativePreflight);
  app.use(cors(createCorsOptionsDelegate(corsOrigin)));
  app.useWebSocketAdapter(
    new CorsIoAdapter(app, parseCorsOrigins(corsOrigin)),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');
}
