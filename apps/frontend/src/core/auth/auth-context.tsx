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
import type { QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/core/api/api-error';
import { toApiError } from '@/core/api/api-error';
import {
  getBareHttpClient,
  setAuthenticationRecovery,
  type AuthenticationRecoveryResult,
} from '@/core/api/api-client';
import { queryClient as defaultQueryClient } from '@/core/query/query-runtime';
import { createAuthService, type AuthService } from './auth-service';
import { credentialStore } from './credential-store';
import type {
  AuthCredentials,
  AuthRegistration,
  AuthSession,
  AuthState,
  AuthStatus,
  RestoreResult,
} from './types';

type AuthContextValue = {
  status: AuthStatus;
  sessionId: string | null;
  error: ApiError | null;
  login(credentials: AuthCredentials): Promise<void>;
  register(registration: AuthRegistration): Promise<void>;
  retryRestore(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = PropsWithChildren<{
  service?: AuthService;
  queryClient?: QueryClient;
}>;

function createDefaultAuthService(): AuthService {
  return createAuthService({ http: getBareHttpClient(), store: credentialStore });
}

export function AuthProvider({ children, service: providedService, queryClient }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'restoring' });
  const [authService] = useState<AuthService>(() => providedService ?? createDefaultAuthService());
  const protectedQueryClient = queryClient ?? defaultQueryClient;
  const mounted = useRef(true);
  const stateRef = useRef<AuthState>({ status: 'restoring' });
  const authenticationInFlight = useRef(false);
  const restoreInFlight = useRef<Promise<RestoreResult> | null>(null);

  const updateState = useCallback((nextState: AuthState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const applyResult = useCallback((result: RestoreResult) => {
    if (!mounted.current) return;
    if (result.status === 'authenticated') {
      updateState({ status: 'authenticated', sessionId: result.sessionId });
    } else if (result.status === 'anonymous') {
      protectedQueryClient.clear();
      updateState({ status: 'anonymous' });
    } else {
      updateState({ status: 'unavailable', error: result.error });
    }
  }, [protectedQueryClient, updateState]);

  const restoreAndApply = useCallback((): Promise<RestoreResult> => {
    if (restoreInFlight.current) return restoreInFlight.current;

    const attempt = Promise.resolve()
      .then(() => (authService.refresh ?? authService.restore)())
      .catch((error: unknown): RestoreResult => {
        const apiError = toApiError(error, { unauthorized: 'session' });
        if (apiError.category === 'session' || apiError.category === 'credentials') {
          return { status: 'anonymous' };
        }
        return { status: 'unavailable', error: apiError };
      });
    restoreInFlight.current = attempt;
    void attempt
      .then(applyResult, () => undefined)
      .then(() => {
        if (restoreInFlight.current === attempt) restoreInFlight.current = null;
      });
    return attempt;
  }, [authService, applyResult]);

  useEffect(() => {
    mounted.current = true;
    const removeRecovery = setAuthenticationRecovery(async (): Promise<AuthenticationRecoveryResult> => {
      const result = await restoreAndApply();
      if (result.status === 'authenticated') return { status: 'authenticated' };
      if (result.status === 'unavailable') return { status: 'unavailable', error: result.error };
      return { status: 'anonymous' };
    });
    void restoreAndApply();
    return () => {
      mounted.current = false;
      removeRecovery();
    };
  }, [restoreAndApply]);

  const authenticate = useCallback(
    async (issueSession: () => Promise<AuthSession>) => {
      if (authenticationInFlight.current) return;
      authenticationInFlight.current = true;
      try {
        const session = await issueSession();
        if (mounted.current) {
          if (
            stateRef.current.status === 'authenticated'
            && stateRef.current.sessionId !== session.sessionId
          ) {
            protectedQueryClient.clear();
          }
          updateState({ status: 'authenticated', sessionId: session.sessionId });
        }
      } finally {
        authenticationInFlight.current = false;
      }
    },
    [protectedQueryClient, updateState],
  );

  const login = useCallback(
    (credentials: AuthCredentials) => authenticate(() => authService.login(credentials)),
    [authService, authenticate],
  );

  const register = useCallback(
    (registration: AuthRegistration) => authenticate(() => authService.register(registration)),
    [authService, authenticate],
  );

  const retryRestore = useCallback(() => {
    updateState({ status: 'restoring' });
    void restoreAndApply();
  }, [restoreAndApply, updateState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      sessionId: state.status === 'authenticated' ? state.sessionId : null,
      error: state.status === 'unavailable' ? state.error : null,
      login,
      register,
      retryRestore,
    }),
    [state, login, register, retryRestore],
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
