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
  setAuthenticationInvalidation,
  setAuthenticationRecovery,
  setAuthenticationSnapshot,
  type AuthenticationSnapshot,
  type AuthenticationRecoveryResult,
} from '@/core/api/api-client';
import { clearAccessToken } from '@/core/api/token-memory';
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
  logout(): Promise<void>;
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
  const identityGeneration = useRef(0);
  const authOperationGeneration = useRef(0);
  const authenticationInFlight = useRef(false);
  const restoreInFlight = useRef<Promise<RestoreResult> | null>(null);
  const logoutInFlight = useRef<Promise<void> | null>(null);

  const updateState = useCallback((nextState: AuthState) => {
    const currentIdentity = stateRef.current.status === 'authenticated'
      ? stateRef.current.sessionId
      : null;
    const nextIdentity = nextState.status === 'authenticated' ? nextState.sessionId : null;
    if (currentIdentity !== nextIdentity) identityGeneration.current += 1;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const readAuthenticationSnapshot = useCallback((): AuthenticationSnapshot => ({
    sessionId: stateRef.current.status === 'authenticated' ? stateRef.current.sessionId : null,
    identityGeneration: identityGeneration.current,
  }), []);

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

    const operationGeneration = authOperationGeneration.current;
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
      .then((result) => {
        if (operationGeneration === authOperationGeneration.current) applyResult(result);
      }, () => undefined)
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
    const removeInvalidation = setAuthenticationInvalidation(async () => {
      try {
        await authService.invalidate?.();
      } finally {
        clearAccessToken();
        protectedQueryClient.clear();
        if (mounted.current) updateState({ status: 'anonymous' });
      }
    });
    const removeSnapshot = setAuthenticationSnapshot(readAuthenticationSnapshot);
    void restoreAndApply();
    return () => {
      mounted.current = false;
      removeRecovery();
      removeInvalidation();
      removeSnapshot();
    };
  }, [authService, protectedQueryClient, readAuthenticationSnapshot, restoreAndApply, updateState]);

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

  const logout = useCallback((): Promise<void> => {
    if (logoutInFlight.current) return logoutInFlight.current;

    authOperationGeneration.current += 1;
    restoreInFlight.current = null;
    const attempt = Promise.resolve()
      .then(() => authService.logout())
      .then(() => {
        clearAccessToken();
        protectedQueryClient.clear();
        if (mounted.current) updateState({ status: 'anonymous' });
      }, (error: unknown) => {
        throw toApiError(error, { unauthorized: 'session' });
      });
    const inFlight = attempt.finally(() => {
      if (logoutInFlight.current === inFlight) logoutInFlight.current = null;
    });
    logoutInFlight.current = inFlight;
    return inFlight;
  }, [authService, protectedQueryClient, updateState]);

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
      logout,
      retryRestore,
    }),
    [state, login, register, logout, retryRestore],
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
