import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { CorsIoAdapter } from './config/cors-io.adapter';
import {
  createCorsOptionsDelegate,
  parseCorsOrigins,
  rejectNativePreflight,
} from './config/cors.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

/**
 * Configuração compartilhada entre o bootstrap real e os testes de contrato
 * HTTP: cookies, CORS consciente do path, validação, formato Problem e prefixo.
 */
export function configureApp(app: INestApplication): void {
  const corsOrigin = app.get(ConfigService).get<string>('CORS_ORIGIN');

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
