import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Formata toda exceção HTTP como application/problem+json (RFC 7807),
 * conforme o contrato de API definido no PRD (seção 10).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const detail =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] } | null)?.message ??
          'Erro interno inesperado';

    response.status(status).contentType('application/problem+json').json({
      type: `https://wise-warrior.app/errors/${status}`,
      title: isHttpException ? exception.name : 'InternalServerError',
      status,
      detail: Array.isArray(detail) ? detail.join('; ') : detail,
      instance: request.url,
    });
  }
}
