import { Platform } from 'react-native';
import type { HttpClient, HttpResponse } from '@/core/api/api-client';
import { isApiError } from '@/core/api/api-error';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/core/api/token-memory';
import { createAuthService } from '@/core/auth/auth-service';
import type { CredentialStore } from '@/core/auth/types';

type Call = { method: 'get' | 'post'; url: string; body?: unknown; options?: unknown };

function deferredVoid() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function httpDouble(handlers: Record<string, () => Promise<HttpResponse<unknown>>>) {
  const calls: Call[] = [];
  const http: HttpClient = {
    async get<T>(url: string): Promise<HttpResponse<T>> {
      calls.push({ method: 'get', url });
      const result = (await handlers[url]?.()) ?? { status: 204, data: undefined };
      return result as HttpResponse<T>;
    },
    async post<T>(url: string, body?: unknown, options?: unknown): Promise<HttpResponse<T>> {
      calls.push(options === undefined
        ? { method: 'post', url, body }
        : { method: 'post', url, body, options });
      const result = (await handlers[url]?.()) ?? { status: 204, data: undefined };
      return result as HttpResponse<T>;
    },
  };
  return { http, calls };
}

type StoreState = { value: string | null; failRead?: boolean; failWrite?: boolean; failRemove?: boolean };

function storeDouble(initial: string | null = null) {
  const state: StoreState = { value: initial };
  const writes: string[] = [];
  let removes = 0;
  const store: CredentialStore = {
    read: async () => {
      if (state.failRead) throw new Error('secure store indisponível');
      return state.value;
    },
    write: async (value) => {
      if (state.failWrite) throw new Error('secure store indisponível');
      writes.push(value);
      state.value = value;
    },
    remove: async () => {
      removes += 1;
      if (state.failRemove) throw new Error('secure store indisponível');
      state.value = null;
    },
  };
  return { store, state, writes, removalCount: () => removes };
}

function axiosError(status: number) {
  return { isAxiosError: true, response: { status, data: {} } };
}

function axiosNetworkError() {
  return { isAxiosError: true, message: 'Network Error' };
}

const ACCESS = 'access-token-1';

describe('auth service — web transport', () => {
  beforeEach(() => clearAccessToken());
  afterEach(() => clearAccessToken());

  it('registers through the web endpoint and keeps the refresh credential in the browser cookie', async () => {
    const { http, calls } = httpDouble({
      '/auth/register': async () => ({
        status: 201,
        data: { accessToken: ACCESS, sessionId: 'session-register-web' },
      }),
    });
    const store = storeDouble();
    const service = createAuthService({ http, store: store.store, platform: 'web' });

    await expect(
      service.register({
        displayName: '  Aria  ',
        email: 'aria@wise.app',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({ sessionId: 'session-register-web' });

    expect(calls).toEqual([
      {
        method: 'post',
        url: '/auth/register',
        body: {
          displayName: '  Aria  ',
          email: 'aria@wise.app',
          password: 'correct horse battery staple',
        },
      },
    ]);
    expect(getAccessToken()).toBe(ACCESS);
    expect(store.writes).toHaveLength(0);
  });

  it('logs in through the web endpoint, keeps the token in memory and never writes storage', async () => {
    const { http, calls } = httpDouble({
      '/auth/login': async () => ({ status: 200, data: { accessToken: ACCESS, sessionId: 'session-1' } }),
    });
    const store = storeDouble();
    const service = createAuthService({ http, store: store.store, platform: 'web' });

    await expect(service.login({ email: 'guerreiro@wise.app', password: 'segredo123' })).resolves.toEqual({
      sessionId: 'session-1',
    });

    expect(calls).toEqual([
      { method: 'post', url: '/auth/login', body: { email: 'guerreiro@wise.app', password: 'segredo123' } },
    ]);
    expect(getAccessToken()).toBe(ACCESS);
    expect(store.writes).toHaveLength(0);
  });

  it('translates a 401 on login into a credentials error', async () => {
    const { http } = httpDouble({ '/auth/login': async () => Promise.reject(axiosError(401)) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      category: 'credentials',
      retryable: false,
    });
  });

  it('rejects a successful login response without a usable session', async () => {
    const { http } = httpDouble({
      '/auth/login': async () => ({ status: 200, data: { accessToken: '', sessionId: '' } }),
    });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      category: 'unexpected',
    });
    expect(getAccessToken()).toBeNull();
  });

  it('surfaces a network failure as a retryable error', async () => {
    const { http } = httpDouble({ '/auth/login': async () => Promise.reject(axiosNetworkError()) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      category: 'network',
      retryable: true,
    });
  });

  it('restores the web session from the refresh cookie and publishes the access token', async () => {
    const { http, calls } = httpDouble({
      '/auth/refresh': async () => ({ status: 200, data: { accessToken: ACCESS, sessionId: 'session-2' } }),
    });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    await expect(service.restore()).resolves.toEqual({ status: 'authenticated', sessionId: 'session-2' });
    expect(calls).toEqual([{ method: 'post', url: '/auth/refresh', body: undefined }]);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('treats a 401 on refresh as an anonymous session and clears the token', async () => {
    const { http } = httpDouble({ '/auth/refresh': async () => Promise.reject(axiosError(401)) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('stays anonymous when refresh returns a malformed session', async () => {
    const { http } = httpDouble({
      '/auth/refresh': async () => ({ status: 200, data: { accessToken: ACCESS } }),
    });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('reports transient unavailability on restore without pretending logout', async () => {
    const { http } = httpDouble({ '/auth/refresh': async () => Promise.reject(axiosError(503)) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    const result = await service.restore();
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.error.category).toBe('server');
      expect(result.error.retryable).toBe(true);
    }
  });
});

describe('auth service — native transport', () => {
  beforeEach(() => clearAccessToken());
  afterEach(() => {
    clearAccessToken();
    jest.restoreAllMocks();
  });

  it('registers through the native endpoint and persists the refresh token before publishing the session', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/register': async () => ({
        status: 201,
        data: {
          accessToken: ACCESS,
          refreshToken: 'session-register-native.refresh-secret',
          sessionId: 'session-register-native',
        },
      }),
    });
    const store = storeDouble();
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    await expect(
      service.register({ displayName: 'Aria', email: 'aria@wise.app', password: 'correct horse battery staple' }),
    ).resolves.toEqual({ sessionId: 'session-register-native' });

    expect(calls).toEqual([
      {
        method: 'post',
        url: '/auth/native/register',
        body: {
          displayName: 'Aria',
          email: 'aria@wise.app',
          password: 'correct horse battery staple',
          deviceLabel: 'Wise Android',
        },
      },
    ]);
    expect(store.writes).toEqual(['session-register-native.refresh-secret']);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('does not authenticate after native registration when secure persistence fails', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/register': async () => ({
        status: 201,
        data: {
          accessToken: ACCESS,
          refreshToken: 'session-register-failed.refresh-secret',
          sessionId: 'session-register-failed',
        },
      }),
      '/auth/native/logout': async () => ({ status: 204, data: undefined }),
    });
    const store = storeDouble();
    store.state.failWrite = true;
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    await expect(
      service.register({ displayName: 'Aria', email: 'aria@wise.app', password: 'correct horse battery staple' }),
    ).rejects.toMatchObject({ category: 'storage' });

    expect(calls).toContainEqual({
      method: 'post',
      url: '/auth/native/logout',
      body: { refreshToken: 'session-register-failed.refresh-secret' },
    });
    expect(store.removalCount()).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it.each([
    ['ios', 'Wise iOS'],
    ['android', 'Wise Android'],
  ] as const)('selects the native endpoint automatically on %s', async (platform, deviceLabel) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const { http, calls } = httpDouble({
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.token', sessionId: 'session-auto' },
      }),
    });
    const service = createAuthService({ http, store: storeDouble().store });

    await service.login({ email: 'a@b.co', password: 'x' });

    expect(calls[0]).toEqual({
      method: 'post',
      url: '/auth/native/login',
      body: { email: 'a@b.co', password: 'x', deviceLabel },
    });
  });

  it('persists the refresh token in the credential store before publishing the session', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.token', sessionId: 'session-3' },
      }),
    });
    const store = storeDouble();
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    await service.login({ email: 'a@b.co', password: 'x' });
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/auth/native/login',
      body: { email: 'a@b.co', password: 'x', deviceLabel: 'Wise iOS' },
    });
    expect(store.writes).toEqual(['session.token']);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('rejects a native login response without a refresh credential', async () => {
    const { http } = httpDouble({
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: ACCESS, sessionId: 'session-3' },
      }),
    });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'ios' });

    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      category: 'unexpected',
    });
    expect(getAccessToken()).toBeNull();
  });

  it('revokes a freshly issued session when secure persistence fails', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.token', sessionId: 'session-3' },
      }),
      '/auth/native/logout': async () => ({ status: 204, data: undefined }),
    });
    const store = storeDouble();
    store.state.failWrite = true;
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    const failure = await service.login({ email: 'a@b.co', password: 'x' }).catch((error: unknown) => error);
    expect(isApiError(failure)).toBe(true);
    expect(calls.map((call) => call.url)).toContain('/auth/native/logout');
    expect(getAccessToken()).toBeNull();
  });

  it('removes the previous credential when secure persistence fails during login', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.new', sessionId: 'session-3' },
      }),
      '/auth/native/logout': async () => ({ status: 204, data: undefined }),
    });
    const store = storeDouble('session.old');
    store.state.failWrite = true;
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      category: 'storage',
    });
    expect(calls).toContainEqual({
      method: 'post',
      url: '/auth/native/logout',
      body: { refreshToken: 'session.new' },
    });
    expect(store.removalCount()).toBe(1);
    expect(store.state.value).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('stays anonymous when there is no stored credential', async () => {
    const { http, calls } = httpDouble({});
    const service = createAuthService({ http, store: storeDouble(null).store, platform: 'android' });
    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(calls).toHaveLength(0);
  });

  it('reports unavailability when the stored credential cannot be read', async () => {
    const store = storeDouble('session.stored');
    store.state.failRead = true;
    const service = createAuthService({ http: httpDouble({}).http, store: store.store, platform: 'ios' });

    const result = await service.restore();

    expect(result).toMatchObject({ status: 'unavailable', error: { category: 'storage' } });
    expect(getAccessToken()).toBeNull();
  });

  it('rotates the stored credential on restore', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/refresh': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.rotated', sessionId: 'session-4' },
      }),
    });
    const store = storeDouble('session.stale');
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    await expect(service.restore()).resolves.toEqual({ status: 'authenticated', sessionId: 'session-4' });
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/auth/native/refresh',
      body: { refreshToken: 'session.stale' },
    });
    expect(store.writes).toEqual(['session.rotated']);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('revokes the rotated session and stays anonymous when persistence fails', async () => {
    const { http, calls } = httpDouble({
      '/auth/native/refresh': async () => ({
        status: 200,
        data: { accessToken: ACCESS, refreshToken: 'session.rotated', sessionId: 'session-4' },
      }),
      '/auth/native/logout': async () => ({ status: 204, data: undefined }),
    });
    const store = storeDouble('session.stale');
    store.state.failWrite = true;
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(calls).toContainEqual({
      method: 'post',
      url: '/auth/native/logout',
      body: { refreshToken: 'session.rotated' },
    });
    expect(store.removalCount()).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it('stays anonymous when native refresh omits the rotated credential', async () => {
    const { http } = httpDouble({
      '/auth/native/refresh': async () => ({
        status: 200,
        data: { accessToken: ACCESS, sessionId: 'session-4' },
      }),
    });
    const store = storeDouble('session.stale');
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('removes the invalid credential and stays anonymous on a 401', async () => {
    const { http } = httpDouble({ '/auth/native/refresh': async () => Promise.reject(axiosError(401)) });
    const store = storeDouble('session.invalid');
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    await expect(service.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(store.removalCount()).toBe(1);
    expect(store.state.value).toBeNull();
  });

  it('keeps the stored credential when the network is unavailable', async () => {
    const { http } = httpDouble({ '/auth/native/refresh': async () => Promise.reject(axiosNetworkError()) });
    const store = storeDouble('session.keep');
    const service = createAuthService({ http, store: store.store, platform: 'ios' });

    const result = await service.restore();
    expect(result.status).toBe('unavailable');
    expect(store.removalCount()).toBe(0);
    expect(store.state.value).toBe('session.keep');
  });
});

describe('auth service — logout', () => {
  beforeEach(() => clearAccessToken());
  afterEach(() => clearAccessToken());

  it('logs out on web without a refresh body and marks the request as auth', async () => {
    const { http, calls } = httpDouble({ '/auth/logout': async () => ({ status: 204, data: undefined }) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();
    expect(calls).toEqual([{
      method: 'post',
      url: '/auth/logout',
      body: undefined,
      options: { requestKind: 'auth' },
    }]);
    expect(getAccessToken()).toBeNull();
  });

  it('treats an invalid web session as a successful logout', async () => {
    const { http } = httpDouble({ '/auth/logout': async () => Promise.reject(axiosError(401)) });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();

    expect(getAccessToken()).toBeNull();
  });

  it('serializes web logout after a concurrent refresh so the cookie stays cleared', async () => {
    const refreshFinished = deferredVoid();
    let cookieValid = true;
    const { http } = httpDouble({
      '/auth/refresh': async () => {
        await refreshFinished.promise;
        cookieValid = true;
        return { status: 200, data: { accessToken: 'refreshed-access', sessionId: 'session-1' } };
      },
      '/auth/logout': async () => {
        cookieValid = false;
        return { status: 204, data: undefined };
      },
    });
    const service = createAuthService({ http, store: storeDouble().store, platform: 'web' });

    const restore = service.restore();
    const logout = service.logout();
    refreshFinished.resolve();

    await expect(Promise.all([restore, logout])).resolves.toEqual([
      { status: 'authenticated', sessionId: 'session-1' },
      undefined,
    ]);
    expect(cookieValid).toBe(false);
  });

  it('does not restore the web session after logout when a new service is created', async () => {
    let cookieValid = true;
    const { http, calls } = httpDouble({
      '/auth/logout': async () => {
        cookieValid = false;
        return { status: 204, data: undefined };
      },
      '/auth/refresh': async () => {
        if (!cookieValid) return Promise.reject(axiosError(401));
        return { status: 200, data: { accessToken: 'restored-access', sessionId: 'session-1' } };
      },
    });
    const first = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    await first.logout();

    const reopened = createAuthService({ http, store: storeDouble().store, platform: 'web' });
    await expect(reopened.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(calls.map((call) => call.url)).toEqual(['/auth/logout', '/auth/refresh']);
  });

  it.each([
    ['network', axiosNetworkError(), 'network'],
    ['server', axiosError(503), 'server'],
  ] as const)('preserves web auth on %s logout failure', async (_label, failure, category) => {
    const { http } = httpDouble({ '/auth/logout': async () => Promise.reject(failure) });
    const store = storeDouble();
    const service = createAuthService({ http, store: store.store, platform: 'web' });
    setAccessToken(ACCESS);

    await expect(service.logout()).rejects.toMatchObject({ category });
    expect(store.removalCount()).toBe(0);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('logs out natively with the stored refresh token before removing it', async () => {
    const { http, calls } = httpDouble({ '/auth/native/logout': async () => ({ status: 204, data: undefined }) });
    const store = storeDouble('native.refresh');
    const service = createAuthService({ http, store: store.store, platform: 'android' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();
    expect(calls).toEqual([{
      method: 'post',
      url: '/auth/native/logout',
      body: { refreshToken: 'native.refresh' },
      options: { requestKind: 'auth' },
    }]);
    expect(store.removalCount()).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it('clears the local session after server confirmation when secure removal fails', async () => {
    const { http, calls } = httpDouble({ '/auth/native/logout': async () => ({ status: 204, data: undefined }) });
    const store = storeDouble('native.refresh');
    store.state.failRemove = true;
    const service = createAuthService({ http, store: store.store, platform: 'android' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();

    expect(calls).toContainEqual({
      method: 'post',
      url: '/auth/native/logout',
      body: { refreshToken: 'native.refresh' },
      options: { requestKind: 'auth' },
    });
    expect(store.removalCount()).toBe(1);
    expect(store.state.value).toBe('native.refresh');
    expect(getAccessToken()).toBeNull();
  });

  it('does not confirm native logout when the refresh credential is absent', async () => {
    const { http, calls } = httpDouble({});
    const store = storeDouble(null);
    const service = createAuthService({ http, store: store.store, platform: 'android' });
    setAccessToken(ACCESS);

    await expect(service.logout()).rejects.toMatchObject({ category: 'storage' });

    expect(calls).toHaveLength(0);
    expect(store.removalCount()).toBe(0);
    expect(getAccessToken()).toBe(ACCESS);
  });

  it('removes a native credential on the next restore after logout deletion failed', async () => {
    const store = storeDouble('native.refresh');
    store.state.failRemove = true;
    const first = createAuthService({
      http: httpDouble({ '/auth/native/logout': async () => ({ status: 204, data: undefined }) }).http,
      store: store.store,
      platform: 'android',
    });

    await expect(first.logout()).resolves.toBeUndefined();

    store.state.failRemove = false;
    const reopenedHttp = httpDouble({
      '/auth/native/refresh': async () => Promise.reject(axiosError(401)),
    });
    const reopened = createAuthService({ http: reopenedHttp.http, store: store.store, platform: 'android' });

    await expect(reopened.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(reopenedHttp.calls).toContainEqual({
      method: 'post',
      url: '/auth/native/refresh',
      body: { refreshToken: 'native.refresh' },
    });
    expect(store.state.value).toBeNull();
  });

  it('serializes native logout after a concurrent refresh rotation', async () => {
    const refreshFinished = deferredVoid();
    const store = storeDouble('native.stale');
    let logoutCredential: string | null = null;
    const { http } = httpDouble({
      '/auth/native/refresh': async () => {
        await refreshFinished.promise;
        return {
          status: 200,
          data: { accessToken: 'rotated-access', refreshToken: 'native.rotated', sessionId: 'session-rotated' },
        };
      },
      '/auth/native/logout': async () => {
        logoutCredential = store.state.value;
        return { status: 204, data: undefined };
      },
    });
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    const restore = service.restore();
    const logout = service.logout();
    refreshFinished.resolve();

    await expect(Promise.all([restore, logout])).resolves.toEqual([
      { status: 'authenticated', sessionId: 'session-rotated' },
      undefined,
    ]);
    expect(logoutCredential).toBe('native.rotated');
    expect(store.state.value).toBeNull();
  });

  it('allows a new native session to restore after logout in the same runtime', async () => {
    const store = storeDouble('native.old');
    const { http } = httpDouble({
      '/auth/native/logout': async () => ({ status: 204, data: undefined }),
      '/auth/native/login': async () => ({
        status: 200,
        data: { accessToken: 'new-access', refreshToken: 'native.new', sessionId: 'session-new' },
      }),
      '/auth/native/refresh': async () => ({
        status: 200,
        data: { accessToken: 'new-access-refreshed', refreshToken: 'native.newer', sessionId: 'session-new' },
      }),
    });
    const service = createAuthService({ http, store: store.store, platform: 'android' });

    await service.logout();
    await service.login({ email: 'a@b.co', password: 'x' });

    await expect(service.restore()).resolves.toEqual({
      status: 'authenticated',
      sessionId: 'session-new',
    });
    expect(getAccessToken()).toBe('new-access-refreshed');
  });

  it('treats an invalid native session as a successful logout', async () => {
    const { http } = httpDouble({ '/auth/native/logout': async () => Promise.reject(axiosError(401)) });
    const store = storeDouble('expired.refresh');
    const service = createAuthService({ http, store: store.store, platform: 'ios' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();
    expect(store.removalCount()).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it('clears the local session after terminal native logout when removal needs retry', async () => {
    const { http } = httpDouble({ '/auth/native/logout': async () => Promise.reject(axiosError(401)) });
    const store = storeDouble('expired.refresh');
    store.state.failRemove = true;
    const service = createAuthService({ http, store: store.store, platform: 'ios' });
    setAccessToken(ACCESS);

    await expect(service.logout()).resolves.toBeUndefined();

    expect(store.removalCount()).toBe(1);
    expect(store.state.value).toBe('expired.refresh');
    expect(getAccessToken()).toBeNull();
  });

  it.each([
    ['network', axiosNetworkError(), 'network'],
    ['server', axiosError(503), 'server'],
  ] as const)('preserves native auth on %s logout failure', async (_label, failure, category) => {
    const { http } = httpDouble({ '/auth/native/logout': async () => Promise.reject(failure) });
    const store = storeDouble('retry.refresh');
    const service = createAuthService({ http, store: store.store, platform: 'ios' });
    setAccessToken(ACCESS);

    await expect(service.logout()).rejects.toMatchObject({ category });
    expect(store.removalCount()).toBe(0);
    expect(store.state.value).toBe('retry.refresh');
    expect(getAccessToken()).toBe(ACCESS);
  });
});
