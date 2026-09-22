import {
  CanceledError,
  create,
  isAxiosError,
} from 'axios';
import { Platform } from 'react-native';
import { getPublicApiUrl } from '@/config/environment';
import { ApiError, isApiError, isCancelled, toApiError } from './api-error';
import { getAccessToken } from './token-memory';

export type HttpResponse<T> = {
  status: number;
  data: T;
};

export type HttpRequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Requests marked as auth/public never start the session recovery flow. */
  requestKind?: 'auth' | 'public';
};

/** Fronteira mínima consumida pelo domínio de auth; facilita testes e troca do transporte. */
export interface HttpClient {
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

export interface HttpClientWithPatch extends HttpClient {
  patch<T = unknown>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
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

export type AuthenticationSnapshot = {
  sessionId: string | null;
  identityGeneration: number;
};

type AuthenticationRecovery = () => Promise<AuthenticationRecoveryResult | boolean>;
export type AuthenticationInvalidation = () => Promise<void> | void;
export type AuthenticationSnapshotReader = () => AuthenticationSnapshot;

let authenticationRecovery: AuthenticationRecovery | null = null;
let recoveryInFlight: Promise<AuthenticationRecoveryResult> | null = null;
let authenticationInvalidation: AuthenticationInvalidation | null = null;
let invalidationInFlight: Promise<void> | null = null;
let invalidatedAuthenticationKey: string | null = null;
let authenticationSnapshotReader: AuthenticationSnapshotReader | null = null;
let successfulRecoveryGeneration = 0;

export function setAuthenticationRecovery(recover: AuthenticationRecovery): () => void {
  authenticationRecovery = recover;
  return () => {
    if (authenticationRecovery === recover) authenticationRecovery = null;
  };
}

export function setAuthenticationInvalidation(invalidate: AuthenticationInvalidation): () => void {
  authenticationInvalidation = invalidate;
  invalidationInFlight = null;
  invalidatedAuthenticationKey = null;
  return () => {
    if (authenticationInvalidation === invalidate) {
      authenticationInvalidation = null;
      invalidationInFlight = null;
      invalidatedAuthenticationKey = null;
    }
  };
}

export function setAuthenticationSnapshot(read: AuthenticationSnapshotReader): () => void {
  authenticationSnapshotReader = read;
  return () => {
    if (authenticationSnapshotReader === read) authenticationSnapshotReader = null;
  };
}

function readAuthenticationSnapshot(): AuthenticationSnapshot | undefined {
  return authenticationSnapshotReader?.();
}

function snapshotsMatch(
  expected: AuthenticationSnapshot | undefined,
  current: AuthenticationSnapshot | undefined = readAuthenticationSnapshot(),
): boolean {
  if (!expected && !current) return true;
  if (!expected || !current) return false;
  return expected.sessionId === current.sessionId
    && expected.identityGeneration === current.identityGeneration;
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
      .then(normalizeRecoveryResult, recoveryFailure)
      .then((result) => {
        if (result.status === 'authenticated') successfulRecoveryGeneration += 1;
        return result;
      });
    recoveryInFlight = attempt.finally(() => {
      recoveryInFlight = null;
    });
  }
  return recoveryInFlight;
}

function invalidateAuthenticationOnce(sessionSnapshot?: AuthenticationSnapshot): Promise<void> {
  if (!authenticationInvalidation) return Promise.resolve();
  const activeSnapshot = sessionSnapshot ?? readAuthenticationSnapshot();
  const key = activeSnapshot
    ? `${activeSnapshot.identityGeneration}:${activeSnapshot.sessionId ?? 'anonymous'}`
    : `recovery:${successfulRecoveryGeneration}`;
  if (invalidatedAuthenticationKey === key) return invalidationInFlight ?? Promise.resolve();

  invalidatedAuthenticationKey = key;
  invalidationInFlight = Promise.resolve()
    .then(() => authenticationInvalidation?.())
    .catch(() => undefined);
  return invalidationInFlight;
}

function isUnauthorized(error: unknown): boolean {
  if (isApiError(error)) return error.status === 401;
  return isAxiosError(error) && error.response?.status === 401;
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
  return true;
}

function safeApiError(error: unknown, unauthorized: 'credentials' | 'session'): ApiError {
  if (isApiError(error)) {
    if (unauthorized === 'session' && error.status === 401 && error.category !== 'session') {
      return new ApiError('session', { status: error.status });
    }
    return error;
  }
  return toApiError(error, { unauthorized });
}

async function replayOnce<T>(
  operation: (options?: HttpRequestOptions) => Promise<HttpResponse<T>>,
  options?: HttpRequestOptions,
  sessionSnapshot?: AuthenticationSnapshot,
): Promise<HttpResponse<T>> {
  throwIfAborted(options?.signal);
  if (!snapshotsMatch(sessionSnapshot)) throw new ApiError('session', { status: 401 });
  try {
    return await operation(options);
  } catch (error) {
    if (isUnauthorized(error) && snapshotsMatch(sessionSnapshot)) {
      await invalidateAuthenticationOnce(sessionSnapshot);
    }
    throw safeApiError(error, 'session');
  }
}

/** Restaura a Session uma única vez antes de repetir uma request protegida rejeitada. */
export function createSessionAwareHttpClient(transport: HttpClientWithPatch): HttpClientWithPatch;
export function createSessionAwareHttpClient(transport: HttpClient): HttpClient;
export function createSessionAwareHttpClient(transport: HttpClient): HttpClient {
  async function request<T>(
    url: string,
    operation: (options?: HttpRequestOptions) => Promise<HttpResponse<T>>,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const sessionSnapshotAtRequestStart = readAuthenticationSnapshot();
    const recoveryGenerationAtRequestStart = successfulRecoveryGeneration;

    try {
      throwIfAborted(options?.signal);
      return await operation(options);
    } catch (error) {
      const unauthorized = isAuthenticationEndpoint(url) || options?.requestKind === 'auth'
        ? 'credentials'
        : 'session';

      if (options?.signal?.aborted || isCancelled(error)) {
        throw safeApiError(error, unauthorized);
      }
      if (!canRecoverAuthentication(url, options) || !isUnauthorized(error)) {
        throw safeApiError(error, unauthorized);
      }

      throwIfAborted(options?.signal);

      if (!snapshotsMatch(sessionSnapshotAtRequestStart)) {
        throw new ApiError('session', { status: 401 });
      }

      if (successfulRecoveryGeneration > recoveryGenerationAtRequestStart) {
        return replayOnce(operation, options, sessionSnapshotAtRequestStart);
      }

      const result = await waitForRecovery(recoverAuthenticationOnce(), options?.signal);
      if (result.status === 'authenticated') {
        return replayOnce(operation, options, sessionSnapshotAtRequestStart);
      }
      if (result.status === 'unavailable') {
        throw result.error;
      }
      throw new ApiError('session', { status: 401 });
    }
  }

  const patchTransport = (transport as Partial<HttpClientWithPatch>).patch;
  return {
    get: <T>(url: string, options?: HttpRequestOptions) =>
      request(url, (requestOptions) => transport.get<T>(url, requestOptions), options),
    post: <T>(url: string, body?: unknown, options?: HttpRequestOptions) =>
      request(url, (requestOptions) => transport.post<T>(url, body, requestOptions), options),
    ...(patchTransport ? {
      patch: <T>(url: string, body?: unknown, options?: HttpRequestOptions) =>
        request<T>(url, (requestOptions) => (transport as HttpClientWithPatch).patch<T>(url, body, requestOptions), options),
    } : {}),
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
export function createHttpClient(config: HttpClientConfig = {}): HttpClientWithPatch {
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
          ? await instance.get<T>(url, { signal: options.signal, headers: options.headers })
          : await instance.get<T>(url, { headers: options?.headers });
        return { status: response.status, data: response.data };
      } catch (error) {
        throw toApiError(error);
      }
    },
    async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      try {
        const response = options?.signal
          ? await instance.post<T>(url, body, { signal: options.signal, headers: options.headers })
          : await instance.post<T>(url, body, { headers: options?.headers });
        return { status: response.status, data: response.data };
      } catch (error) {
        throw toApiError(error);
      }
    },
    async patch<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      try {
        const response = options?.signal
          ? await instance.patch<T>(url, body, { signal: options.signal, headers: options.headers })
          : await instance.patch<T>(url, body, { headers: options?.headers });
        return { status: response.status, data: response.data };
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}

let authenticatedClient: HttpClientWithPatch | null = null;
let bareClient: HttpClient | null = null;

export function shouldSendBrowserCredentials(platform = Platform.OS): boolean {
  return platform === 'web';
}

/** Cliente autenticado para rotas de produto; usa somente o bearer em memória. */
export function getAuthenticatedHttpClient(): HttpClientWithPatch {
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
