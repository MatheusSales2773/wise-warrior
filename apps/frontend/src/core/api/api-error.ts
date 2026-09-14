import { isAxiosError, isCancel } from 'axios';

/**
 * Categorias estáveis que a UI usa para escolher o texto público. Nenhum
 * detalhe do backend (password, refresh, Authorization ou body) atravessa daqui.
 */
export type ApiErrorCategory =
  | 'validation'
  | 'credentials'
  | 'conflict'
  | 'session'
  | 'network'
  | 'server'
  | 'storage'
  | 'cancelled'
  | 'unexpected';

const RETRYABLE: ReadonlySet<ApiErrorCategory> = new Set(['network', 'server']);

export type ApiErrorOptions = {
  status?: number;
};

export class ApiError extends Error {
  readonly category: ApiErrorCategory;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(category: ApiErrorCategory, options: ApiErrorOptions = {}) {
    super(`ApiError:${category}`);
    this.name = 'ApiError';
    this.category = category;
    this.status = options.status;
    this.retryable = RETRYABLE.has(category);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export type ClassifyOptions = {
  unauthorized?: 'credentials' | 'session';
};

export function isCancelled(error: unknown): boolean {
  if (isApiError(error)) return error.category === 'cancelled';
  if (isCancel(error)) return true;
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'CanceledError';
}

/**
 * Converte falhas de transporte em categorias sem expor o `detail` do
 * problem+json. A UI usa somente a taxonomia pública.
 */
export function toApiError(error: unknown, options: ClassifyOptions = {}): ApiError {
  if (isApiError(error)) return error;

  if (isCancelled(error)) return new ApiError('cancelled');

  if (!isAxiosError(error)) {
    return new ApiError('unexpected');
  }

  const response = error.response;
  if (!response) {
    return new ApiError('network');
  }

  const status = response.status;

  if (status === 400) return new ApiError('validation', { status });
  if (status === 401) return new ApiError(options.unauthorized ?? 'credentials', { status });
  if (status === 409) return new ApiError('conflict', { status });
  if (status >= 500) return new ApiError('server', { status });
  return new ApiError('unexpected', { status });
}
