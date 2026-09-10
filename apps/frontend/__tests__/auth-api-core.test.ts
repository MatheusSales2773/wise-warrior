import {
  applyAuthorizationHeader,
  DEFAULT_TIMEOUT_MS,
  resolveAxiosConfig,
} from '@/core/api/api-client';
import { ApiError, isApiError, toApiError } from '@/core/api/api-error';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/core/api/token-memory';

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
    expect(network.problemDetail).toBeUndefined();

    const server = toApiError({
      isAxiosError: true,
      response: { status: 503, data: { detail: 'serviço fora' } },
    });
    expect(server.category).toBe('server');
    expect(server.retryable).toBe(true);
    expect(server.problemDetail).toBe('serviço fora');

    const validation = toApiError({ isAxiosError: true, response: { status: 400, data: {} } });
    expect(validation.category).toBe('validation');
    expect(validation.retryable).toBe(false);
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
});

describe('http client configuration', () => {
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

  it('injects a bearer header only when an access token exists', () => {
    const request = { headers: { set: jest.fn() } };
    applyAuthorizationHeader(request, null);
    expect(request.headers.set).not.toHaveBeenCalled();

    applyAuthorizationHeader(request, 'access-123');
    expect(request.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer access-123');
  });
});
