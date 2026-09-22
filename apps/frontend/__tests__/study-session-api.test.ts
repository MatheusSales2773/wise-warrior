import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { getActiveStudySession, heartbeatStudySession, pauseStudySession, resumeStudySession, startStudySession } from '@/features/study-session/api';

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

it('sends pause with the expected version and preserves its idempotency key', async () => {
  const post = jest.fn().mockResolvedValue({ data: { id: 'study-1', state: 'paused' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });

  await expect(pauseStudySession('study-1', 4, 'pause-retry-key')).resolves.toMatchObject({
    id: 'study-1', state: 'paused', receivedAtMs: expect.any(Number),
  });
  expect(post).toHaveBeenCalledWith('/sessions/study-1/pause', { expectedVersion: 4 }, {
    headers: { 'Idempotency-Key': 'pause-retry-key' },
  });
});

it('sends resume with the expected version and preserves its idempotency key', async () => {
  const post = jest.fn().mockResolvedValue({ data: { id: 'study-1', state: 'running' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });

  await expect(resumeStudySession('study-1', 5, 'resume-retry-key')).resolves.toMatchObject({
    id: 'study-1', state: 'running', receivedAtMs: expect.any(Number),
  });
  expect(post).toHaveBeenCalledWith('/sessions/study-1/resume', { expectedVersion: 5 }, {
    headers: { 'Idempotency-Key': 'resume-retry-key' },
  });
});
