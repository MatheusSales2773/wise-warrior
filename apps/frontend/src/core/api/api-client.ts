import { create } from 'axios';
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

/** Cliente autenticado para rotas de produto; inclui cookie (Web) e bearer. */
export function getAuthenticatedHttpClient(): HttpClient {
  if (!authenticatedClient) {
    authenticatedClient = createHttpClient({
      bearer: getAccessToken,
      withCredentials: defaultWithCredentials(),
    });
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
