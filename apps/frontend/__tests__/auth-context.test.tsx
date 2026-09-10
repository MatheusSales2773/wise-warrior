import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AuthProvider, useAuth } from '@/core/auth/auth-context';
import type { AuthService } from '@/core/auth/auth-service';
import { ApiError } from '@/core/api/api-error';
import type { AuthSession, RestoreResult } from '@/core/auth/types';

function serviceDouble(
  restore: () => Promise<RestoreResult>,
  login: (() => Promise<AuthSession>) | undefined = async () => ({ sessionId: 'session-login' }),
): AuthService {
  return { restore, login };
}

function wrapperFor(service: AuthService) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <AuthProvider service={service}>{children}</AuthProvider>;
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
});
