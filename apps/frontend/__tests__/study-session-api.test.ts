import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { getActiveStudySession, heartbeatStudySession, startStudySession } from '@/features/study-session/api';

jest.mock('@/core/api/api-client', () => ({ getAuthenticatedHttpClient: jest.fn() }));

it('maps 204 to absence and forwards the abort signal', async () => {
  const get = jest.fn().mockResolvedValue({ status: 204, data: undefined });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get });
  const signal = new AbortController().signal;
  await expect(getActiveStudySession(signal)).resolves.toBeNull();
  expect(get).toHaveBeenCalledWith('/sessions/active', { signal });
});

it('sends the chosen preset with its idempotency key', async () => {
  const post = jest.fn().mockResolvedValue({ status: 201, data: { id: 'study-1' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });
  await expect(startStudySession(1500, 'start-once')).resolves.toEqual({ id: 'study-1', receivedAtMs: expect.any(Number) });
  expect(post).toHaveBeenCalledWith('/sessions', { plannedDurationSeconds: 1500 }, { headers: { 'Idempotency-Key': 'start-once' } });
});

it('sends a heartbeat to the active Study Session endpoint', async () => {
  const patch = jest.fn().mockResolvedValue({ status: 204, data: undefined });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ patch });
  const signal = new AbortController().signal;

  await heartbeatStudySession('study-1', signal);

  expect(patch).toHaveBeenCalledWith('/sessions/study-1/heartbeat', undefined, { signal });
});
