import { Platform } from 'react-native';
import { ApiError, toApiError } from '@/core/api/api-error';
import type { HttpClient } from '@/core/api/api-client';
import { clearAccessToken, setAccessToken } from '@/core/api/token-memory';
import type {
  AuthCredentials,
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

export type AuthServiceDeps = {
  http: HttpClient;
  store: CredentialStore;
  platform?: string;
};

export interface AuthService {
  login(credentials: AuthCredentials): Promise<AuthSession>;
  restore(): Promise<RestoreResult>;
}

const NATIVE_DEVICE_LABELS: Record<string, string> = {
  ios: 'Wise iOS',
  android: 'Wise Android',
};

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

export function createAuthService({
  http,
  store,
  platform = Platform.OS,
}: AuthServiceDeps): AuthService {
  const isWeb = platform === 'web';

  return {
    async login(credentials: AuthCredentials): Promise<AuthSession> {
      const path = isWeb ? '/auth/login' : '/auth/native/login';
      const body = isWeb
        ? { email: credentials.email, password: credentials.password }
        : {
            email: credentials.email,
            password: credentials.password,
            deviceLabel: NATIVE_DEVICE_LABELS[platform] ?? 'Wise Native',
          };

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
          await rollbackUnstoredRefreshToken(http, payload.refreshToken);
          throw new ApiError('unexpected');
        }
      }

      setAccessToken(payload.accessToken);
      return { sessionId: payload.sessionId };
    },

    async restore(): Promise<RestoreResult> {
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
        return { status: 'unavailable', error: new ApiError('unexpected') };
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
    },
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
