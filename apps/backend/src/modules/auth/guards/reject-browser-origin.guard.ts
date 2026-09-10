import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Recusa qualquer requisição nativa que apresente `Origin`, inclusive
 * `Origin: null`. É defesa em profundidade: o header é controlado pelo
 * navegador, não autentica o aplicativo e nunca substitui a posse do refresh
 * token. Também afasta uso acidental do endpoint nativo por JavaScript Web.
 */
@Injectable()
export class RejectBrowserOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== undefined) {
      throw new ForbiddenException(
        'Este endpoint não aceita requisições de navegador',
      );
    }
    return true;
  }
}
