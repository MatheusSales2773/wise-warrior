import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import type { NextFunction, Request, Response } from 'express';

/** Metro Web é o runtime Web da M3; o Vite foi removido. */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:8081';

const NATIVE_AUTH_SEGMENT = '/auth/native';

/**
 * Converte `CORS_ORIGIN` em uma allowlist explícita. Com credenciais ativas o
 * wildcard é inválido, então uma configuração insegura falha no boot em vez de
 * refletir qualquer origem.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const value = raw?.trim();
  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error('CORS_ORIGIN must be explicitly set in production');
    }
    return [DEFAULT_CORS_ORIGIN];
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN must not contain the "*" wildcard when credentials are enabled',
    );
  }
  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }
  return origins;
}

/** `/auth/native/*` nunca participa do contrato CORS Web. */
export function isNativeAuthPath(path: string): boolean {
  const cleanPath = path.split('?')[0] ?? '';
  return (
    cleanPath.endsWith(NATIVE_AUTH_SEGMENT) ||
    cleanPath.includes(`${NATIVE_AUTH_SEGMENT}/`)
  );
}

/**
 * CORS consciente do path. O contrato Web recebe somente a allowlist
 * configurada com credenciais; endpoints nativos nunca recebem permissão CORS.
 */
export function createCorsOptionsDelegate(
  raw: string | undefined,
): CorsOptionsDelegate<Request> {
  const origins = parseCorsOrigins(raw);
  return (req, callback) => {
    const options: CorsOptions = isNativeAuthPath(req.path)
      ? { origin: false }
      : { origin: origins, credentials: true };
    callback(null, options);
  };
}

/**
 * Defesa em profundidade: preflight Web para `/auth/native/*` é recusado antes
 * de qualquer parsing ou credencial. Não é prova de plataforma — apenas nega o
 * caminho de navegador ao transporte nativo.
 */
export function rejectNativePreflight(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === 'OPTIONS' && isNativeAuthPath(req.path)) {
    res.status(403).end();
    return;
  }
  next();
}
