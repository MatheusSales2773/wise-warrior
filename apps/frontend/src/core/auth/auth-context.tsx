import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { ApiError } from '@/core/api/api-error';
import { getBareHttpClient } from '@/core/api/api-client';
import { createAuthService, type AuthService } from './auth-service';
import { credentialStore } from './credential-store';
import type { AuthCredentials, AuthState, AuthStatus, RestoreResult } from './types';

type AuthContextValue = {
  status: AuthStatus;
  sessionId: string | null;
  error: ApiError | null;
  login(credentials: AuthCredentials): Promise<void>;
  retryRestore(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = PropsWithChildren<{ service?: AuthService }>;

function createDefaultAuthService(): AuthService {
  return createAuthService({ http: getBareHttpClient(), store: credentialStore });
}

export function AuthProvider({ children, service: providedService }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'restoring' });
  const [authService] = useState<AuthService>(() => providedService ?? createDefaultAuthService());
  const mounted = useRef(true);
  const loginInFlight = useRef(false);

  const applyResult = useCallback((result: RestoreResult) => {
    if (!mounted.current) return;
    if (result.status === 'authenticated') {
      setState({ status: 'authenticated', sessionId: result.sessionId });
    } else if (result.status === 'anonymous') {
      setState({ status: 'anonymous' });
    } else {
      setState({ status: 'unavailable', error: result.error });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void authService.restore().then(applyResult);
    return () => {
      mounted.current = false;
    };
  }, [authService, applyResult]);

  const login = useCallback(
    async (credentials: AuthCredentials) => {
      if (loginInFlight.current) return;
      loginInFlight.current = true;
      try {
        const session = await authService.login(credentials);
        if (mounted.current) {
          setState({ status: 'authenticated', sessionId: session.sessionId });
        }
      } finally {
        loginInFlight.current = false;
      }
    },
    [authService],
  );

  const retryRestore = useCallback(() => {
    setState({ status: 'restoring' });
    void authService.restore().then(applyResult);
  }, [authService, applyResult]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      sessionId: state.status === 'authenticated' ? state.sessionId : null,
      error: state.status === 'unavailable' ? state.error : null,
      login,
      retryRestore,
    }),
    [state, login, retryRestore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return value;
}
