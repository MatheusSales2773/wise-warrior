import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createCorsOptionsDelegate, rejectNativePreflight } from './config/cors.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

/**
 * Configuração compartilhada entre o bootstrap real e os testes de contrato
 * HTTP: cookies, CORS consciente do path, validação, formato Problem e prefixo.
 */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.use(rejectNativePreflight);
  app.use(cors(createCorsOptionsDelegate(process.env.CORS_ORIGIN)));
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
