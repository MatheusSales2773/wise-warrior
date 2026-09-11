import { create, isAxiosError } from 'axios';
import { Platform } from 'react-native';
import { getPublicApiUrl } from '@/config/environment';
import { getAccessToken } from './token-memory';

export type HttpResponse<T> = {
  status: number;
  data: T;
};

/** Fronteira mínima consumida pelo domínio de auth; facilita testes e troca do transporte. */
export interface HttpClient {
  get<T = unknown>(url: string): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, body?: unknown): Promise<HttpResponse<T>>;
}

export type HttpClientConfig = {
  baseURL?: string;
  bearer?: () => string | null;
  timeoutMs?: number;
  withCredentials?: boolean;
};

export const DEFAULT_TIMEOUT_MS = 15_000;

type AuthenticationRecovery = () => Promise<boolean>;

let authenticationRecovery: AuthenticationRecovery | null = null;
let recoveryInFlight: Promise<boolean> | null = null;

export function setAuthenticationRecovery(recover: AuthenticationRecovery): () => void {
  authenticationRecovery = recover;
  return () => {
    if (authenticationRecovery === recover) authenticationRecovery = null;
  };
}

function recoverAuthenticationOnce(): Promise<boolean> {
  if (!authenticationRecovery) return Promise.resolve(false);
  if (!recoveryInFlight) {
    const attempt = Promise.resolve().then(() => authenticationRecovery?.() ?? false);
    recoveryInFlight = attempt.finally(() => {
      recoveryInFlight = null;
    });
  }
  return recoveryInFlight;
}

function isUnauthorized(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}

/** Restaura a Session uma única vez antes de repetir uma request protegida rejeitada. */
export function createSessionAwareHttpClient(transport: HttpClient): HttpClient {
  async function request<T>(operation: () => Promise<HttpResponse<T>>): Promise<HttpResponse<T>> {
    try {
      return await operation();
    } catch (error) {
      if (!isUnauthorized(error) || !(await recoverAuthenticationOnce())) throw error;
      return operation();
    }
  }

  return {
    get: <T>(url: string) => request(() => transport.get<T>(url)),
    post: <T>(url: string, body?: unknown) => request(() => transport.post<T>(url, body)),
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
 * access token em memória.
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
    async get<T>(url: string): Promise<HttpResponse<T>> {
      const response = await instance.get<T>(url);
      return { status: response.status, data: response.data };
    },
    async post<T>(url: string, body?: unknown): Promise<HttpResponse<T>> {
      const response = await instance.post<T>(url, body);
      return { status: response.status, data: response.data };
    },
  };
}

let authenticatedClient: HttpClient | null = null;
let bareClient: HttpClient | null = null;

function defaultWithCredentials(): boolean {
  return Platform.OS === 'web';
}

/** Cliente autenticado para rotas de produto; usa somente o bearer em memória. */
export function getAuthenticatedHttpClient(): HttpClient {
  if (!authenticatedClient) {
    authenticatedClient = createSessionAwareHttpClient(
      createHttpClient({ bearer: getAccessToken }),
    );
  }
  return authenticatedClient;
}

/** Cliente sem bearer para cadastro, login, refresh e logout, evitando recursão futura. */
export function getBareHttpClient(): HttpClient {
  if (!bareClient) {
    bareClient = createHttpClient({ withCredentials: defaultWithCredentials() });
  }
  return bareClient;
}
