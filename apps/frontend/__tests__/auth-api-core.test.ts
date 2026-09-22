import * as axios from 'axios';
import { Platform } from 'react-native';
import {
  applyAuthorizationHeader,
  createSessionAwareHttpClient,
  createHttpClient,
  DEFAULT_TIMEOUT_MS,
  getAuthenticatedHttpClient,
  resolveAxiosConfig,
  setAuthenticationInvalidation,
  setAuthenticationRecovery,
  setAuthenticationSnapshot,
  shouldSendBrowserCredentials,
  type HttpClient,
  type HttpClientWithPatch,
  type HttpResponse,
} from '@/core/api/api-client';
import { ApiError, isApiError, isCancelled, toApiError } from '@/core/api/api-error';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/core/api/token-memory';

jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  create: jest.fn(),
}));

describe('token memory', () => {
  afterEach(() => clearAccessToken());

  it('starts empty and stores an access token only in memory', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('access-123');
    expect(getAccessToken()).toBe('access-123');
    setAccessToken('');
    expect(getAccessToken()).toBeNull();
    setAccessToken('access-456');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});

describe('api error taxonomy', () => {
  it('classifies transport failures without leaking credentials', () => {
    const network = toApiError(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    expect(network.category).toBe('network');
    expect(network.retryable).toBe(true);
    expect(network).not.toHaveProperty('problemDetail');

    const server = toApiError({
      isAxiosError: true,
      response: { status: 503, data: { detail: 'serviço fora' } },
    });
    expect(server.category).toBe('server');
    expect(server.retryable).toBe(true);
    expect(server).not.toHaveProperty('problemDetail');

    const validation = toApiError({ isAxiosError: true, response: { status: 400, data: {} } });
    expect(validation.category).toBe('validation');
    expect(validation.retryable).toBe(false);

    const sensitive = toApiError({
      isAxiosError: true,
      response: { status: 500, data: { detail: 'refreshToken=do-not-expose' } },
    });
    expect(sensitive).not.toHaveProperty('problemDetail');

    const reflectedSecret = toApiError({
      isAxiosError: true,
      response: { status: 500, data: { detail: 'request-id=jwt.eyJhbGciOiJub25lIn0.secret' } },
    });
    expect(reflectedSecret).not.toHaveProperty('problemDetail');
  });

  it('lets the caller decide whether a 401 means credentials or an invalid session', () => {
    const unauthorized = { isAxiosError: true, response: { status: 401, data: {} } };
    expect(toApiError(unauthorized).category).toBe('credentials');
    expect(toApiError(unauthorized, { unauthorized: 'session' }).category).toBe('session');
  });

  it('maps 409 to conflict and returns existing ApiError instances untouched', () => {
    expect(toApiError({ isAxiosError: true, response: { status: 409, data: {} } }).category).toBe('conflict');
    const existing = new ApiError('unexpected');
    expect(toApiError(existing)).toBe(existing);
    expect(isApiError(existing)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });

  it('uses one cancellation predicate for Axios, DOM and public API errors', () => {
    const axiosCancellation = new axios.CanceledError('cancelled');
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const publicCancellation = new ApiError('cancelled');

    expect(isCancelled(axiosCancellation)).toBe(true);
    expect(isCancelled(abortError)).toBe(true);
    expect(isCancelled(publicCancellation)).toBe(true);
    expect(toApiError(axiosCancellation).category).toBe('cancelled');
    expect(toApiError(abortError).category).toBe('cancelled');
  });
});

describe('http client configuration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps browser cookies off authenticated product requests', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/v1';
    try {
      const create = jest.mocked(axios.create).mockReturnValue({
        interceptors: { request: { use: jest.fn() } },
      } as never);

      getAuthenticatedHttpClient();

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ withCredentials: false }));
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.EXPO_PUBLIC_API_URL;
      } else {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
      }
    }
  });

  it('resolves the bounded timeout, base URL and credential policy', () => {
    expect(
      resolveAxiosConfig({
        baseURL: 'http://localhost:3000/api/v1',
        withCredentials: true,
        timeoutMs: 1234,
      }),
    ).toEqual({
      baseURL: 'http://localhost:3000/api/v1',
      timeout: 1234,
      withCredentials: true,
    });
  });

  it('defaults to no credentials and a bounded timeout', () => {
    expect(resolveAxiosConfig({ baseURL: 'http://localhost:3000/api/v1' })).toEqual({
      baseURL: 'http://localhost:3000/api/v1',
      timeout: DEFAULT_TIMEOUT_MS,
      withCredentials: false,
    });
  });

  it.each([
    ['web', true],
    ['ios', false],
    ['android', false],
  ] as const)('selects cookie transport only for %s', (platform, expected) => {
    expect(shouldSendBrowserCredentials(platform)).toBe(expected);
  });

  it('injects a bearer header only when an access token exists', () => {
    const request = { headers: { set: jest.fn() } };
    applyAuthorizationHeader(request, null);
    expect(request.headers.set).not.toHaveBeenCalled();

    applyAuthorizationHeader(request, 'access-123');
    expect(request.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer access-123');
  });

  it('restores once and retries concurrent product requests rejected with 401', async () => {
    let restored = false;
    const getCalls = jest.fn();
    const transport: HttpClient = {
      get: async <T,>() => {
        getCalls();
        if (!restored) {
          throw { isAxiosError: true, response: { status: 401, data: {} } };
        }
        return { status: 200, data: 'ok' as T };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    };
    const recover = jest.fn(async () => {
      restored = true;
      return true;
    });
    const removeRecovery = setAuthenticationRecovery(recover);

    try {
      const client = createSessionAwareHttpClient(transport);
      await expect(Promise.all([client.get('/perfil'), client.get('/guilda')])).resolves.toEqual([
        { status: 200, data: 'ok' },
        { status: 200, data: 'ok' },
      ]);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(getCalls).toHaveBeenCalledTimes(4);
    } finally {
      removeRecovery();
    }
  });

  it('restores once and retries protected PATCH requests rejected with 401', async () => {
    let restored = false;
    const patchCalls = jest.fn();
    const transport: HttpClientWithPatch = {
      get: async <T,>() => ({ status: 204, data: undefined as T }),
      post: async <T,>() => ({ status: 204, data: undefined as T }),
      patch: async <T,>() => {
        patchCalls();
        if (!restored) {
          throw { isAxiosError: true, response: { status: 401, data: {} } };
        }
        return { status: 204, data: undefined as T };
      },
    };
    const recover = jest.fn(async () => {
      restored = true;
      return true;
    });
    const removeRecovery = setAuthenticationRecovery(recover);

    try {
      const client = createSessionAwareHttpClient(transport);
      await expect(client.patch('/sessions/study-1/heartbeat')).resolves.toEqual({
        status: 204,
        data: undefined,
      });
      expect(recover).toHaveBeenCalledTimes(1);
      expect(patchCalls).toHaveBeenCalledTimes(2);
    } finally {
      removeRecovery();
    }
  });

  it('does not recover authentication endpoints or cancelled requests', async () => {
    const recover = jest.fn(async () => true);
    const removeRecovery = setAuthenticationRecovery(recover);
    const transport: HttpClient = {
      get: async () => {
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    };

    try {
      const client = createSessionAwareHttpClient(transport);
      await expect(client.get('/auth/refresh')).rejects.toMatchObject({ category: 'credentials', status: 401 });
      await expect(client.get('/perfil', { requestKind: 'auth' })).rejects.toMatchObject({ category: 'credentials', status: 401 });

      const controller = new AbortController();
      controller.abort();
      await expect(client.get('/perfil', { signal: controller.signal })).rejects.toMatchObject({ category: 'cancelled' });
      expect(recover).not.toHaveBeenCalled();
    } finally {
      removeRecovery();
    }
  });

  it('does not start a second refresh when the single replay also receives 401', async () => {
    setAccessToken('access-old');
    let requests = 0;
    const recover = jest.fn(async () => {
      setAccessToken('access-new');
      return true;
    });
    const removeRecovery = setAuthenticationRecovery(recover);
    const client = createSessionAwareHttpClient({
      get: async () => {
        requests += 1;
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });

    try {
      await expect(client.get('/perfil')).rejects.toMatchObject({ category: 'session', status: 401 });
      expect(requests).toBe(2);
      expect(recover).toHaveBeenCalledTimes(1);
    } finally {
      removeRecovery();
      clearAccessToken();
    }
  });

  it('invalidates the session once when the single replay also receives 401', async () => {
    setAccessToken('access-old');
    let requests = 0;
    const recover = jest.fn(async () => {
      setAccessToken('access-new');
      return true;
    });
    const invalidate = jest.fn(async () => {
      clearAccessToken();
    });
    const removeRecovery = setAuthenticationRecovery(recover);
    const removeInvalidation = setAuthenticationInvalidation(invalidate);
    const client = createSessionAwareHttpClient({
      get: async () => {
        requests += 1;
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });

    try {
      await expect(client.get('/perfil')).rejects.toMatchObject({ category: 'session', status: 401 });
      expect(requests).toBe(2);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(getAccessToken()).toBeNull();
    } finally {
      removeRecovery();
      removeInvalidation();
      clearAccessToken();
    }
  });

  it('does not replay a request after the active session changes', async () => {
    setAccessToken('access-session-a');
    let snapshot: { sessionId: string | null; identityGeneration: number } = {
      sessionId: 'session-a',
      identityGeneration: 1,
    };
    const removeSnapshot = setAuthenticationSnapshot(() => snapshot);
    const recover = jest.fn(async () => true);
    const removeRecovery = setAuthenticationRecovery(recover);
    let rejectInitialRequest: (error: unknown) => void = () => undefined;
    const initialRequest = new Promise<HttpResponse<unknown>>((_, reject) => {
      rejectInitialRequest = reject;
    });
    let requests = 0;
    const client = createSessionAwareHttpClient({
      get: async <T,>() => {
        requests += 1;
        return initialRequest as Promise<HttpResponse<T>>;
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });

    try {
      const request = client.get('/perfil');
      await Promise.resolve();
      snapshot = { sessionId: 'session-b', identityGeneration: 2 };
      setAccessToken('access-session-b');
      rejectInitialRequest({ isAxiosError: true, response: { status: 401, data: {} } });

      await expect(request).rejects.toMatchObject({ category: 'session', status: 401 });
      expect(requests).toBe(1);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      removeRecovery();
      removeSnapshot();
      clearAccessToken();
    }
  });

  it('reuses the same successful refresh for a late concurrent 401', async () => {
    setAccessToken('access-session-a');
    const removeSnapshot = setAuthenticationSnapshot(() => ({
      sessionId: 'session-a',
      identityGeneration: 1,
    }));
    let rejectLateRequest: (error: unknown) => void = () => undefined;
    const lateInitialRequest = new Promise<HttpResponse<unknown>>((_, reject) => {
      rejectLateRequest = reject;
    });
    let requests = 0;
    const recover = jest.fn(async () => {
      setAccessToken('access-session-a-refreshed');
      return true;
    });
    const removeRecovery = setAuthenticationRecovery(recover);
    const client = createSessionAwareHttpClient({
      get: async <T,>() => {
        requests += 1;
        if (requests === 1) {
          throw { isAxiosError: true, response: { status: 401, data: {} } };
        }
        if (requests === 2) return lateInitialRequest as Promise<HttpResponse<T>>;
        return { status: 200, data: 'ok' as T };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });

    try {
      const first = client.get('/primeiro');
      const late = client.get('/atrasada');
      await expect(first).resolves.toEqual({ status: 200, data: 'ok' });
      rejectLateRequest({ isAxiosError: true, response: { status: 401, data: {} } });

      await expect(late).resolves.toEqual({ status: 200, data: 'ok' });
      expect(recover).toHaveBeenCalledTimes(1);
      expect(requests).toBe(4);
    } finally {
      removeRecovery();
      removeSnapshot();
      clearAccessToken();
    }
  });

  it('runs terminal invalidation once per authenticated session', async () => {
    setAccessToken('access-session-a');
    let snapshot = { sessionId: 'session-a', identityGeneration: 1 };
    const removeSnapshot = setAuthenticationSnapshot(() => snapshot);
    const recover = jest.fn(async () => {
      setAccessToken(`access-${recover.mock.calls.length + 1}`);
      return true;
    });
    const invalidate = jest.fn(async () => undefined);
    const removeRecovery = setAuthenticationRecovery(recover);
    const removeInvalidation = setAuthenticationInvalidation(invalidate);
    const client = createSessionAwareHttpClient({
      get: async () => {
        throw { isAxiosError: true, response: { status: 401, data: {} } };
      },
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    });

    try {
      await expect(client.get('/perfil')).rejects.toMatchObject({ category: 'session', status: 401 });
      snapshot = { sessionId: 'session-b', identityGeneration: 2 };
      setAccessToken('access-session-b');
      await expect(client.get('/perfil')).rejects.toMatchObject({ category: 'session', status: 401 });

      expect(recover).toHaveBeenCalledTimes(2);
      expect(invalidate).toHaveBeenCalledTimes(2);
    } finally {
      removeRecovery();
      removeInvalidation();
      removeSnapshot();
      clearAccessToken();
    }
  });

  it('translates Axios failures into a safe error and forwards cancellation to the transport', async () => {
    const instance = {
      interceptors: { request: { use: jest.fn() } },
      get: jest.fn().mockRejectedValue({
        isAxiosError: true,
        config: { headers: { Authorization: 'Bearer access-secret' }, data: { password: 'secret' } },
        response: {
          status: 400,
          data: { detail: 'payload não deve atravessar a fronteira' },
        },
      }),
      post: jest.fn(),
    };
    jest.mocked(axios.create).mockReturnValue(instance as never);
    const signal = new AbortController().signal;
    const client = createHttpClient({ baseURL: 'https://api.example.com' });

    const error = await client.get('/perfil', { signal }).catch((value: unknown) => value);

    expect(error).toMatchObject({ category: 'validation', status: 400 });
    expect(error).not.toHaveProperty('response');
    expect(error).not.toHaveProperty('config');
    expect(instance.get).toHaveBeenCalledWith('/perfil', { signal });
  });
});
