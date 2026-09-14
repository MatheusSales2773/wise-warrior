import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { AuthProvider, useAuth } from '@/core/auth/auth-context';
import { createAuthService, type AuthService } from '@/core/auth/auth-service';
import { ApiError } from '@/core/api/api-error';
import {
  createSessionAwareHttpClient,
  type HttpClient,
  type HttpResponse,
} from '@/core/api/api-client';
import type { AuthRegistration, AuthSession, CredentialStore, RestoreResult } from '@/core/auth/types';
import { clearAccessToken, getAccessToken } from '@/core/api/token-memory';

function serviceDouble(
  restore: () => Promise<RestoreResult>,
  login: (() => Promise<AuthSession>) | undefined = async () => ({ sessionId: 'session-login' }),
  register: (() => Promise<AuthSession>) | undefined = async () => ({ sessionId: 'session-register' }),
): AuthService {
  return { restore, login, register };
}

function wrapperFor(service: AuthService, queryClient?: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <AuthProvider queryClient={queryClient} service={service}>{children}</AuthProvider>;
  };
}

describe('AuthProvider', () => {
  it('moves from restoring to authenticated using the restored session id', async () => {
    const restore = jest.fn(async (): Promise<RestoreResult> => ({ status: 'authenticated', sessionId: 'session-1' }));
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore)) });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.sessionId).toBe('session-1');
    expect(result.current.error).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('starts in restoring before the session resolves', async () => {
    const restore = jest.fn(
      () =>
        new Promise<RestoreResult>(() => {
          // never resolves during this assertion
        }),
    );
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore)) });
    expect(result.current.status).toBe('restoring');
    expect(result.current.sessionId).toBeNull();
  });

  it('settles on anonymous when there is no valid session', async () => {
    const restore = jest.fn(async (): Promise<RestoreResult> => ({ status: 'anonymous' }));
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore)) });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.sessionId).toBeNull();
  });

  it('exposes a retry that preserves the session and recovers from unavailable', async () => {
    const restore = jest
      .fn<Promise<RestoreResult>, []>()
      .mockResolvedValueOnce({ status: 'unavailable', error: new ApiError('network') })
      .mockResolvedValueOnce({ status: 'authenticated', sessionId: 'session-retry' });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore)) });

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.error?.category).toBe('network');

    await act(async () => {
      result.current.retryRestore();
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it('shares one restore attempt across repeated retries while unavailable', async () => {
    let refreshes = 0;
    let resolveRetry: (response: HttpResponse<unknown>) => void = () => undefined;
    const retryResponse = new Promise<HttpResponse<unknown>>((resolve) => {
      resolveRetry = resolve;
    });
    const authHttp: HttpClient = {
      get: async <T,>() => ({ status: 204, data: undefined as T }),
      post: async <T,>(url: string) => {
        if (url !== '/auth/refresh') return { status: 204, data: undefined as T };
        refreshes += 1;
        if (refreshes === 1) {
          throw { isAxiosError: true, response: { status: 503, data: {} } };
        }
        return retryResponse as Promise<HttpResponse<T>>;
      },
    };
    const store: CredentialStore = {
      read: async () => null,
      write: async () => undefined,
      remove: async () => undefined,
    };
    const service = createAuthService({ http: authHttp, store, platform: 'web' });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(service) });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    await act(async () => {
      result.current.retryRestore();
      result.current.retryRestore();
      await Promise.resolve();
    });

    const refreshesStarted = refreshes;
    await act(async () => {
      resolveRetry({
        status: 200,
        data: { accessToken: 'access-retry', sessionId: 'session-retry' },
      });
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(refreshesStarted).toBe(2);
    expect(refreshes).toBe(2);
  });

  it('publishes the login session and propagates login failures without changing state', async () => {
    const restore = jest.fn(async (): Promise<RestoreResult> => ({ status: 'anonymous' }));
    const login = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-login' }));
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore, login)) });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    await act(async () => {
      await result.current.login({ email: 'a@b.co', password: 'x' });
    });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.sessionId).toBe('session-login');

    const failing = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('credentials', { status: 401 });
    });
    const second = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore, failing)) });
    await waitFor(() => expect(second.result.current.status).toBe('anonymous'));
    await act(async () => {
      await second.result.current.login({ email: 'a@b.co', password: 'bad' }).catch(() => undefined);
    });
    expect(second.result.current.status).toBe('anonymous');
  });

  it('publishes the registration session and propagates registration failures without changing state', async () => {
    const restore = jest.fn(async (): Promise<RestoreResult> => ({ status: 'anonymous' }));
    const registration: AuthRegistration = {
      displayName: 'Aria',
      email: 'aria@wise.app',
      password: 'correct horse battery staple',
    };
    const register = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-register' }));
    const { result } = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(serviceDouble(restore, undefined, register)),
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    await act(async () => {
      await result.current.register(registration);
    });

    expect(register).toHaveBeenCalledWith(registration);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.sessionId).toBe('session-register');

    const failing = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('storage');
    });
    const second = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(serviceDouble(restore, undefined, failing)),
    });
    await waitFor(() => expect(second.result.current.status).toBe('anonymous'));
    await act(async () => {
      await second.result.current.register(registration).catch(() => undefined);
    });
    expect(second.result.current.status).toBe('anonymous');
    expect(second.result.current.sessionId).toBeNull();
  });

  it('ignores a restore result that arrives after unmount', async () => {
    let resolveRestore: (result: RestoreResult) => void = () => undefined;
    const restore = jest.fn(
      () =>
        new Promise<RestoreResult>((resolve) => {
          resolveRestore = resolve;
        }),
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = await renderHook(() => useAuth(), { wrapper: wrapperFor(serviceDouble(restore)) });
    expect(result.current.status).toBe('restoring');

    await unmount();
    await act(async () => {
      resolveRestore({ status: 'authenticated', sessionId: 'late' });
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('becomes anonymous when a protected request finds an invalid Session', async () => {
    let refreshes = 0;
    const authHttp: HttpClient = {
      get: async <T,>() => ({ status: 204, data: undefined as T }),
      post: async <T,>(url: string) => {
        if (url !== '/auth/refresh') return { status: 204, data: undefined as T };
        refreshes += 1;
        if (refreshes === 1) {
          return {
            status: 200,
            data: { accessToken: 'access-1', sessionId: 'session-1' } as T,
          };
        }
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
    };
    const store: CredentialStore = {
      read: async () => null,
      write: async () => undefined,
      remove: async () => undefined,
    };
    const service = createAuthService({ http: authHttp, store, platform: 'web' });
    const protectedQueryClient = new QueryClient();
    protectedQueryClient.setQueryData(['protected'], { secret: 'do-not-keep' });
    const productHttp = createSessionAwareHttpClient({
      get: async () => {
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });
    const { result } = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(service, protectedQueryClient),
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await productHttp.get('/perfil').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(refreshes).toBe(2);
    expect(protectedQueryClient.getQueryData(['protected'])).toBeUndefined();
  });

  it('invalidates the credential and protected cache when the replay remains unauthorized', async () => {
    let refreshes = 0;
    const authHttp: HttpClient = {
      get: async <T,>() => ({ status: 204, data: undefined as T }),
      post: async <T,>(url: string) => {
        if (url !== '/auth/refresh') return { status: 204, data: undefined as T };
        refreshes += 1;
        return {
          status: 200,
          data: { accessToken: `access-${refreshes}`, sessionId: 'session-1' } as T,
        };
      },
    };
    const remove = jest.fn(async () => undefined);
    const store: CredentialStore = {
      read: async () => null,
      write: async () => undefined,
      remove,
    };
    const service = createAuthService({ http: authHttp, store, platform: 'web' });
    const protectedQueryClient = new QueryClient();
    protectedQueryClient.setQueryData(['protected'], { secret: 'do-not-keep' });
    const productHttp = createSessionAwareHttpClient({
      get: async () => {
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });
    const { result } = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(service, protectedQueryClient),
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(getAccessToken()).toBe('access-1');

    await act(async () => {
      await productHttp.get('/perfil').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(refreshes).toBe(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(protectedQueryClient.getQueryData(['protected'])).toBeUndefined();
    protectedQueryClient.clear();
    clearAccessToken();
  });

  it('does not replay a pending request from the previous session after login', async () => {
    const restore = jest.fn(async (): Promise<RestoreResult> => ({
      status: 'authenticated',
      sessionId: 'session-a',
    }));
    const login = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-b' }));
    let rejectInitialRequest: (error: unknown) => void = () => undefined;
    const initialRequest = new Promise<HttpResponse<unknown>>((_, reject) => {
      rejectInitialRequest = reject;
    });
    let requests = 0;
    const productHttp = createSessionAwareHttpClient({
      get: async <T,>() => {
        requests += 1;
        if (requests === 1) return initialRequest as Promise<HttpResponse<T>>;
        return { status: 200, data: 'must-not-replay' as T };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });
    const { result } = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(serviceDouble(restore, login)),
    });
    await waitFor(() => expect(result.current.sessionId).toBe('session-a'));

    const request = productHttp.get('/perfil');
    await act(async () => {
      await result.current.login({ email: 'a@b.co', password: 'correct' });
    });
    expect(result.current.sessionId).toBe('session-b');
    rejectInitialRequest({ isAxiosError: true, response: { status: 401, data: {} } });

    await expect(request).rejects.toMatchObject({ category: 'session', status: 401 });
    expect(requests).toBe(1);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.sessionId).toBe('session-b');
  });

  it('preserves the protected cache and exposes retryable state when refresh is unavailable', async () => {
    let refreshes = 0;
    const authHttp: HttpClient = {
      get: async <T,>() => ({ status: 204, data: undefined as T }),
      post: async <T,>(url: string) => {
        if (url !== '/auth/refresh') return { status: 204, data: undefined as T };
        refreshes += 1;
        if (refreshes === 1) {
          return {
            status: 200,
            data: { accessToken: 'access-1', sessionId: 'session-1' } as T,
          };
        }
        throw { isAxiosError: true, response: { status: 503, data: {} } };
      },
    };
    const store: CredentialStore = {
      read: async () => null,
      write: async () => undefined,
      remove: async () => undefined,
    };
    const service = createAuthService({ http: authHttp, store, platform: 'web' });
    const protectedQueryClient = new QueryClient();
    protectedQueryClient.setQueryData(['protected'], { stillValidDuringOutage: true });
    const productHttp = createSessionAwareHttpClient({
      get: async () => {
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });
    const { result } = await renderHook(() => useAuth(), {
      wrapper: wrapperFor(service, protectedQueryClient),
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await productHttp.get('/perfil').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.error?.category).toBe('server');
    expect(protectedQueryClient.getQueryData(['protected'])).toEqual({ stillValidDuringOutage: true });
    expect(refreshes).toBe(2);
    protectedQueryClient.clear();
  });
});
