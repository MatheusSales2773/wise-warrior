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
        ({ data: payload } = await http.post<SessionPayload>(path, body));
      } catch (error) {
        throw toApiError(error, { unauthorized: 'credentials' });
      }

      if (!isWeb && payload.refreshToken) {
        try {
          await store.write(payload.refreshToken);
        } catch {
          await revokeQuietly(http, payload.refreshToken);
          clearAccessToken();
          throw new ApiError('unexpected');
        }
      }

      setAccessToken(payload.accessToken);
      return { sessionId: payload.sessionId };
    },

    async restore(): Promise<RestoreResult> {
      if (isWeb) {
        try {
          const { data } = await http.post<SessionPayload>('/auth/refresh');
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
        const { data } = await http.post<SessionPayload>('/auth/native/refresh', {
          refreshToken: stored,
        });
        if (data.refreshToken) {
          try {
            await store.write(data.refreshToken);
          } catch {
            await revokeQuietly(http, data.refreshToken);
            await store.remove();
            clearAccessToken();
            return { status: 'anonymous' };
          }
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
