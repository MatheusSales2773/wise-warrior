import {
  CanceledError,
  create,
  isAxiosError,
  isCancel,
} from 'axios';
import { Platform } from 'react-native';
import { getPublicApiUrl } from '@/config/environment';
import { ApiError, isApiError, toApiError } from './api-error';
import { getAccessToken } from './token-memory';

export type HttpResponse<T> = {
  status: number;
  data: T;
};

export type HttpRequestOptions = {
  signal?: AbortSignal;
  /** Requests marked as auth/public never start the session recovery flow. */
  requestKind?: 'protected' | 'auth' | 'public';
  /** Internal marker carried by the one allowed replay of a protected request. */
  replayed?: boolean;
  /** Explicit escape hatch for callers that cannot use requestKind. */
  skipAuthenticationRecovery?: boolean;
};

/** Fronteira mínima consumida pelo domínio de auth; facilita testes e troca do transporte. */
export interface HttpClient {
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

export type HttpClientConfig = {
  baseURL?: string;
  bearer?: () => string | null;
  timeoutMs?: number;
  withCredentials?: boolean;
};

export const DEFAULT_TIMEOUT_MS = 15_000;

export type AuthenticationRecoveryResult =
  | { status: 'authenticated' }
  | { status: 'anonymous' }
  | { status: 'unavailable'; error: ApiError };

type AuthenticationRecovery = () => Promise<AuthenticationRecoveryResult | boolean>;

let authenticationRecovery: AuthenticationRecovery | null = null;
let recoveryInFlight: Promise<AuthenticationRecoveryResult> | null = null;

export function setAuthenticationRecovery(recover: AuthenticationRecovery): () => void {
  authenticationRecovery = recover;
  return () => {
    if (authenticationRecovery === recover) authenticationRecovery = null;
  };
}

function normalizeRecoveryResult(value: AuthenticationRecoveryResult | boolean): AuthenticationRecoveryResult {
  if (value === true || (typeof value === 'object' && value.status === 'authenticated')) {
    return { status: 'authenticated' };
  }

  if (typeof value === 'object' && value.status === 'unavailable') {
    return { status: 'unavailable', error: value.error };
  }

  return { status: 'anonymous' };
}

function recoveryFailure(error: unknown): AuthenticationRecoveryResult {
  const apiError = toApiError(error, { unauthorized: 'session' });
  if (apiError.category === 'session' || apiError.category === 'credentials') {
    return { status: 'anonymous' };
  }
  return { status: 'unavailable', error: apiError };
}

function recoverAuthenticationOnce(): Promise<AuthenticationRecoveryResult> {
  if (!authenticationRecovery) return Promise.resolve({ status: 'anonymous' });
  if (!recoveryInFlight) {
    const attempt = Promise.resolve()
      .then(() => authenticationRecovery?.() ?? false)
      .then(normalizeRecoveryResult, recoveryFailure);
    recoveryInFlight = attempt.finally(() => {
      recoveryInFlight = null;
    });
  }
  return recoveryInFlight;
}

function isUnauthorized(error: unknown): boolean {
  if (isApiError(error)) return error.status === 401;
  return isAxiosError(error) && error.response?.status === 401;
}

function isCancelledError(error: unknown): boolean {
  if (isApiError(error)) return error.category === 'cancelled';
  if (isCancel(error)) return true;
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'CanceledError';
}

function cancellationError(): CanceledError<unknown> {
  return new CanceledError('Request cancelled');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancellationError();
}

async function waitForRecovery(
  recovery: Promise<AuthenticationRecoveryResult>,
  signal?: AbortSignal,
): Promise<AuthenticationRecoveryResult> {
  if (!signal) return recovery;
  throwIfAborted(signal);

  let removeAbortListener: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    const onAbort = () => reject(cancellationError());
    signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener('abort', onAbort);
  });

  try {
    return await Promise.race([recovery, cancelled]);
  } finally {
    removeAbortListener?.();
  }
}

function isAuthenticationEndpoint(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  return /(^|\/)auth(?:\/|$)/i.test(path);
}

function canRecoverAuthentication(url: string, options?: HttpRequestOptions): boolean {
  if (isAuthenticationEndpoint(url)) return false;
  if (options?.requestKind === 'auth' || options?.requestKind === 'public') return false;
  if (options?.replayed || options?.skipAuthenticationRecovery) return false;
  return true;
}

function safeApiError(error: unknown, unauthorized: 'credentials' | 'session'): ApiError {
  if (isApiError(error)) {
    if (unauthorized === 'session' && error.status === 401 && error.category !== 'session') {
      return new ApiError('session', { status: error.status, problemDetail: error.problemDetail });
    }
    return error;
  }
  return toApiError(error, { unauthorized });
}

async function replayOnce<T>(
  operation: (options?: HttpRequestOptions) => Promise<HttpResponse<T>>,
  options?: HttpRequestOptions,
): Promise<HttpResponse<T>> {
  throwIfAborted(options?.signal);
  try {
    return await operation({ ...options, replayed: true });
  } catch (error) {
    throw safeApiError(error, 'session');
  }
}

/** Restaura a Session uma única vez antes de repetir uma request protegida rejeitada. */
export function createSessionAwareHttpClient(transport: HttpClient): HttpClient {
  async function request<T>(
    url: string,
    operation: (options?: HttpRequestOptions) => Promise<HttpResponse<T>>,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const tokenAtRequestStart = getAccessToken();

    try {
      throwIfAborted(options?.signal);
      return await operation(options);
    } catch (error) {
      const unauthorized = isAuthenticationEndpoint(url) || options?.requestKind === 'auth'
        ? 'credentials'
        : 'session';

      if (options?.signal?.aborted || isCancelledError(error)) {
        throw safeApiError(error, unauthorized);
      }
      if (!canRecoverAuthentication(url, options) || !isUnauthorized(error)) {
        throw safeApiError(error, unauthorized);
      }

      throwIfAborted(options?.signal);

      // A response may have been produced by a request sent with an older
      // access token while another request already completed the rotation.
      // Reuse that token instead of starting a second refresh.
      if (getAccessToken() !== tokenAtRequestStart) {
        return replayOnce(operation, options);
      }

      const result = await waitForRecovery(recoverAuthenticationOnce(), options?.signal);
      if (result.status === 'authenticated') {
        return replayOnce(operation, options);
      }
      if (result.status === 'unavailable') {
        throw result.error;
      }
      throw new ApiError('session', { status: 401 });
    }
  }

  return {
    get: <T>(url: string, options?: HttpRequestOptions) =>
      request(url, (requestOptions) => transport.get<T>(url, requestOptions), options),
    post: <T>(url: string, body?: unknown, options?: HttpRequestOptions) =>
      request(url, (requestOptions) => transport.post<T>(url, body, requestOptions), options),
  };
}

export function resolveAxiosConfig(config: HttpClientConfig = {}) {
  return {
    baseURL: config.baseURL ?? getPublicApiUrl(),
    timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    withCredentials: config.withCredentials ?? false,
  };
}

/** Adiciona o bearer somente quando há access token em memória. */
export function applyAuthorizationHeader(
  request: { headers: { set(name: string, value: string): void } },
  token: string | null,
): void {
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
}

/**
 * Cria o cliente HTTP. `withCredentials` só é ativado na Web, onde o cookie de
 * refresh precisa viajar; o header bearer é injetado apenas quando existe
 * access token em memória. Erros Axios são reduzidos à taxonomia pública antes
 * de atravessarem esta fronteira.
 */
export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const instance = create(resolveAxiosConfig(config));

  const bearer = config.bearer;
  if (bearer) {
    instance.interceptors.request.use((request) => {
      applyAuthorizationHeader(request, bearer());
      return request;
    });
  }

  return {
    async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      try {
        const response = options?.signal
          ? await instance.get<T>(url, { signal: options.signal })
          : await instance.get<T>(url);
        return { status: response.status, data: response.data };
      } catch (error) {
        throw toApiError(error);
      }
    },
    async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      try {
        const response = options?.signal
          ? await instance.post<T>(url, body, { signal: options.signal })
          : await instance.post<T>(url, body);
        return { status: response.status, data: response.data };
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}

let authenticatedClient: HttpClient | null = null;
let bareClient: HttpClient | null = null;

export function shouldSendBrowserCredentials(platform = Platform.OS): boolean {
  return platform === 'web';
}

/** Cliente autenticado para rotas de produto; usa somente o bearer em memória. */
export function getAuthenticatedHttpClient(): HttpClient {
  if (!authenticatedClient) {
    authenticatedClient = createSessionAwareHttpClient(
      createHttpClient({ bearer: getAccessToken, withCredentials: false }),
    );
  }
  return authenticatedClient;
}

/** Cliente sem bearer para cadastro, login, refresh e logout, evitando recursão futura. */
export function getBareHttpClient(): HttpClient {
  if (!bareClient) {
    bareClient = createHttpClient({ withCredentials: shouldSendBrowserCredentials() });
  }
  return bareClient;
}
