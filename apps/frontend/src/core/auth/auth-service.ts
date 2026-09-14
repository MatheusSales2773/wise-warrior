import { Platform } from 'react-native';
import { ApiError, toApiError } from '@/core/api/api-error';
import type { HttpClient } from '@/core/api/api-client';
import { clearAccessToken, setAccessToken } from '@/core/api/token-memory';
import type {
  AuthCredentials,
  AuthRegistration,
  AuthSession,
  CredentialStore,
  RestoreResult,
} from './types';

type SessionPayload = {
  accessToken: string;
  sessionId: string;
  refreshToken?: string;
};

function requireSessionPayload(value: unknown, refreshTokenRequired = false): SessionPayload {
  if (typeof value !== 'object' || value === null) {
    throw new ApiError('unexpected');
  }

  const payload = value as Partial<SessionPayload>;
  if (
    !payload.accessToken?.trim()
    || !payload.sessionId?.trim()
    || (refreshTokenRequired && !payload.refreshToken?.trim())
  ) {
    throw new ApiError('unexpected');
  }
  return payload as SessionPayload;
}

export type AuthPlatform = 'web' | 'ios' | 'android';

type NativeAuthPlatform = Exclude<AuthPlatform, 'web'>;
type NativeDeviceLabel = 'Wise iOS' | 'Wise Android';

export type AuthServiceDeps = {
  http: HttpClient;
  store: CredentialStore;
  platform?: AuthPlatform;
};

export interface AuthService {
  login(credentials: AuthCredentials): Promise<AuthSession>;
  register(registration: AuthRegistration): Promise<AuthSession>;
  logout(): Promise<void>;
  restore(): Promise<RestoreResult>;
  /** Refreshes an existing credential; kept optional for small test adapters. */
  refresh?: () => Promise<RestoreResult>;
  /** Discards the local credential after a terminal protected-request failure. */
  invalidate?: () => Promise<void>;
}

const NATIVE_DEVICE_LABELS: Record<NativeAuthPlatform, NativeDeviceLabel> = {
  ios: 'Wise iOS',
  android: 'Wise Android',
};

function resolveRuntimePlatform(value: string): AuthPlatform {
  if (value === 'web' || value === 'ios' || value === 'android') {
    return value;
  }
  throw new ApiError('unexpected');
}

function nativeDeviceLabel(platform: AuthPlatform): NativeDeviceLabel {
  if (platform === 'ios' || platform === 'android') {
    return NATIVE_DEVICE_LABELS[platform];
  }
  throw new ApiError('unexpected');
}

function assertLogoutResponse(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 401) throw new ApiError('session', { status });
  if (status >= 500) throw new ApiError('server', { status });
  throw new ApiError('unexpected', { status });
}

function toLogoutApiError(error: unknown): ApiError {
  const apiError = toApiError(error, { unauthorized: 'session' });
  if (apiError.status === 401 && apiError.category !== 'session') {
    return new ApiError('session', { status: apiError.status });
  }
  return apiError;
}

/** Melhor esforço: ao falhar a persistência segura, o token recém-emitido é revogado. */
async function revokeQuietly(http: HttpClient, refreshToken: string): Promise<void> {
  try {
    await http.post('/auth/native/logout', { refreshToken });
  } catch {
    // A sessão será descartada localmente de qualquer forma.
  }
}

async function rollbackUnstoredRefreshToken(
  http: HttpClient,
  refreshToken: string,
  removeStoredCredential?: () => Promise<void>,
): Promise<void> {
  await revokeQuietly(http, refreshToken);
  await removeStoredCredential?.().catch(() => undefined);
  clearAccessToken();
}

async function removeStoredCredential(store: CredentialStore): Promise<void> {
  try {
    await store.remove();
  } catch {
    throw new ApiError('storage');
  }
}

export function createAuthService({
  http,
  store,
  platform,
}: AuthServiceDeps): AuthService {
  const runtimePlatform = resolveRuntimePlatform(platform ?? Platform.OS);
  const isWeb = runtimePlatform === 'web';
  let sessionOperationTail: Promise<void> = Promise.resolve();
  let sessionLoggedOut = false;

  function enqueueSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = sessionOperationTail.then(operation, operation);
    sessionOperationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function authenticate(
    path: string,
    body: Record<string, string | undefined>,
  ): Promise<AuthSession> {
    let payload: SessionPayload;
    try {
      const response = await http.post<unknown>(path, body);
      payload = requireSessionPayload(response.data, !isWeb);
    } catch (error) {
      clearAccessToken();
      throw toApiError(error, { unauthorized: 'credentials' });
    }

    if (!isWeb && payload.refreshToken) {
      try {
        await store.write(payload.refreshToken);
      } catch {
        await rollbackUnstoredRefreshToken(http, payload.refreshToken, () => store.remove());
        throw new ApiError('storage');
      }
    }

    sessionLoggedOut = false;
    setAccessToken(payload.accessToken);
    return { sessionId: payload.sessionId };
  }

  async function refreshCurrent(): Promise<RestoreResult> {
    if (isWeb) {
      try {
        const response = await http.post<unknown>('/auth/refresh');
        const data = requireSessionPayload(response.data);
        setAccessToken(data.accessToken);
        return { status: 'authenticated', sessionId: data.sessionId };
      } catch (error) {
        return resolveRestoreFailure(error);
      }
    }

    let stored: string | null;
    try {
      stored = await store.read();
    } catch {
      return { status: 'unavailable', error: new ApiError('storage') };
    }
    if (!stored) {
      clearAccessToken();
      return { status: 'anonymous' };
    }

    try {
      const response = await http.post<unknown>('/auth/native/refresh', {
        refreshToken: stored,
      });
      const data = requireSessionPayload(response.data, true);
      try {
        await store.write(data.refreshToken!);
      } catch {
        await rollbackUnstoredRefreshToken(http, data.refreshToken!, () => store.remove());
        return { status: 'anonymous' };
      }
      setAccessToken(data.accessToken);
      return { status: 'authenticated', sessionId: data.sessionId };
    } catch (error) {
      return resolveRestoreFailure(error, () => store.remove());
    }
  }

  async function refresh(): Promise<RestoreResult> {
    return enqueueSessionOperation(async () => {
      if (sessionLoggedOut) {
        clearAccessToken();
        return { status: 'anonymous' };
      }
      return refreshCurrent();
    });
  }

  async function invalidate(): Promise<void> {
    clearAccessToken();
    await store.remove().catch(() => undefined);
  }

  async function logoutCurrent(): Promise<void> {
    let refreshToken: string | null = null;
    if (!isWeb) {
      try {
        refreshToken = await store.read();
      } catch {
        throw new ApiError('storage');
      }
      if (!refreshToken) {
        throw new ApiError('storage');
      }
    }

    try {
      const response = await http.post(
        isWeb ? '/auth/logout' : '/auth/native/logout',
        isWeb ? undefined : { refreshToken },
        { requestKind: 'auth' },
      );
      assertLogoutResponse(response.status);
    } catch (error) {
      const apiError = toLogoutApiError(error);
      if (apiError.category !== 'session') throw apiError;
    }

    if (!isWeb) await removeStoredCredential(store);
    clearAccessToken();
  }

  async function logout(): Promise<void> {
    return enqueueSessionOperation(async () => {
      const previousSessionState = sessionLoggedOut;
      try {
        await logoutCurrent();
        sessionLoggedOut = true;
      } catch (error) {
        sessionLoggedOut = previousSessionState;
        throw error;
      }
    });
  }

  return {
    async register(registration: AuthRegistration): Promise<AuthSession> {
      const path = isWeb ? '/auth/register' : '/auth/native/register';
      const body = isWeb
        ? {
            displayName: registration.displayName,
            email: registration.email,
            password: registration.password,
          }
        : {
            displayName: registration.displayName,
            email: registration.email,
            password: registration.password,
            deviceLabel: nativeDeviceLabel(runtimePlatform),
          };

      return authenticate(path, body);
    },

    async login(credentials: AuthCredentials): Promise<AuthSession> {
      const path = isWeb ? '/auth/login' : '/auth/native/login';
      const body = isWeb
        ? { email: credentials.email, password: credentials.password }
        : {
            email: credentials.email,
            password: credentials.password,
            deviceLabel: nativeDeviceLabel(runtimePlatform),
          };

      return authenticate(path, body);
    },

    refresh,
    restore: refresh,
    invalidate,
    logout,
  };
}

/**
 * Traduz a falha do refresh para o estado de sessão. Um `401` significa
 * credencial inválida (o chamador pode removê-la), rede/5xx preserva a
 * credencial e oferece retry, e qualquer outro status encerra localmente.
 */
async function resolveRestoreFailure(
  error: unknown,
  onInvalidSession?: () => Promise<void>,
): Promise<RestoreResult> {
  const apiError = toApiError(error, { unauthorized: 'session' });
  if (apiError.category === 'session') {
    await onInvalidSession?.().catch(() => undefined);
    clearAccessToken();
    return { status: 'anonymous' };
  }
  if (apiError.retryable) {
    return { status: 'unavailable', error: apiError };
  }
  clearAccessToken();
  return { status: 'anonymous' };
}
