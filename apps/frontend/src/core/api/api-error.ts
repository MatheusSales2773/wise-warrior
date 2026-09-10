import { isAxiosError } from 'axios';

/**
 * Categorias estáveis que a UI usa para escolher o texto público. Nenhum
 * detalhe do backend (password, refresh, Authorization) atravessa daqui.
 */
export type ApiErrorCategory =
  | 'validation'
  | 'credentials'
  | 'conflict'
  | 'session'
  | 'network'
  | 'server'
  | 'unexpected';

const RETRYABLE: ReadonlySet<ApiErrorCategory> = new Set(['network', 'server']);

export type ApiErrorOptions = {
  status?: number;
  problemDetail?: string;
};

export class ApiError extends Error {
  readonly category: ApiErrorCategory;
  readonly status?: number;
  readonly problemDetail?: string;
  readonly retryable: boolean;

  constructor(category: ApiErrorCategory, options: ApiErrorOptions = {}) {
    super(`ApiError:${category}`);
    this.name = 'ApiError';
    this.category = category;
    this.status = options.status;
    this.problemDetail = options.problemDetail;
    this.retryable = RETRYABLE.has(category);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export type ClassifyOptions = {
  unauthorized?: 'credentials' | 'session';
};

function problemDetailOf(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === 'string' ? detail : undefined;
}

/**
 * Converte falhas de transporte em categorias. O `detail` do problem+json é
 * preservado apenas para diagnóstico/testes; a UI nunca o exibe.
 */
export function toApiError(error: unknown, options: ClassifyOptions = {}): ApiError {
  if (isApiError(error)) return error;

  if (!isAxiosError(error)) {
    return new ApiError('unexpected');
  }

  const response = error.response;
  if (!response) {
    return new ApiError('network');
  }

  const status = response.status;
  const problemDetail = problemDetailOf(response.data);

  if (status === 400) return new ApiError('validation', { status, problemDetail });
  if (status === 401) return new ApiError(options.unauthorized ?? 'credentials', { status, problemDetail });
  if (status === 409) return new ApiError('conflict', { status, problemDetail });
  if (status >= 500) return new ApiError('server', { status, problemDetail });
  return new ApiError('unexpected', { status, problemDetail });
}
