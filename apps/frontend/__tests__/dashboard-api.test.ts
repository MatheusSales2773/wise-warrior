import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { ApiError } from '@/core/api/api-error';
import { getMyProfile, getRecentStudySessions } from '@/features/dashboard/api';

jest.mock('@/core/api/api-client', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

describe('dashboard API', () => {
  it('uses the authenticated client and forwards the abort signal', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: [] });
    (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get });
    const signal = new AbortController().signal;
    await getMyProfile({ signal });
    await getRecentStudySessions({ signal });
    expect(get).toHaveBeenNthCalledWith(1, '/users/me', { signal });
    expect(get).toHaveBeenNthCalledWith(2, '/sessions/recent', { signal });
  });

  it.each([
    ['a Problem error', new ApiError('validation', { status: 400 })],
    ['a network error', new ApiError('network')],
    ['a cancelled request', new ApiError('cancelled')],
  ])('propagates %s without treating it as dashboard data', async (_description, error) => {
    const get = jest.fn().mockRejectedValue(error);
    (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get });

    await expect(getMyProfile()).rejects.toBe(error);
    await expect(getRecentStudySessions()).rejects.toBe(error);
  });

  it('uses the M3 authenticated-client recovery after a 401 and returns its replay', async () => {
    const { createSessionAwareHttpClient, setAuthenticationRecovery } = jest.requireActual<typeof import('@/core/api/api-client')>('@/core/api/api-client');
    const recoveredProfile = { id: 'user-1' };
    let recovered = false;
    let requestCount = 0;
    const transportGet = async <T,>() => {
      requestCount += 1;
      if (!recovered) throw { isAxiosError: true, response: { status: 401, data: {} } };
      return { status: 200, data: recoveredProfile as T };
    };
    const recover = jest.fn(async () => {
      recovered = true;
      return true;
    });
    const removeRecovery = setAuthenticationRecovery(recover);
    (getAuthenticatedHttpClient as jest.Mock).mockReturnValue(createSessionAwareHttpClient({
      get: transportGet,
      post: async <T,>() => ({ status: 204, data: undefined as T }),
    }));

    try {
      await expect(getMyProfile()).resolves.toBe(recoveredProfile);
      expect(requestCount).toBe(2);
      expect(recover).toHaveBeenCalledTimes(1);
    } finally {
      removeRecovery();
    }
  });
});
