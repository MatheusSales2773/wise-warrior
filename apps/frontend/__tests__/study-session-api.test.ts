import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { getActiveStudySession, getRecentStudySessionSubjects, heartbeatStudySession, pauseStudySession, resumeStudySession, startStudySession, stopStudySession } from '@/features/study-session/api';

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

it('sends the Matéria only when one was chosen and keeps Sem matéria as absence', async () => {
  const post = jest.fn().mockResolvedValue({ status: 201, data: { id: 'study-1', subject: 'Cálculo II' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });
  await startStudySession(900, 'with-subject', 'Cálculo II');
  expect(post).toHaveBeenLastCalledWith('/sessions', { plannedDurationSeconds: 900, subject: 'Cálculo II' }, { headers: { 'Idempotency-Key': 'with-subject' } });
  await startStudySession(900, 'without-subject', null);
  expect(post).toHaveBeenLastCalledWith('/sessions', { plannedDurationSeconds: 900 }, { headers: { 'Idempotency-Key': 'without-subject' } });
});

it('starts in guild mode only when a Raid is given', async () => {
  const post = jest.fn().mockResolvedValue({ status: 201, data: { id: 'study-1', mode: 'guild', raidId: 'raid-1' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });
  await startStudySession(1500, 'guild-start', null, 'raid-1');
  expect(post).toHaveBeenLastCalledWith(
    '/sessions',
    { plannedDurationSeconds: 1500, mode: 'guild', raidId: 'raid-1' },
    { headers: { 'Idempotency-Key': 'guild-start' } },
  );
});

it('unwraps the recent Matérias and forwards the abort signal', async () => {
  const get = jest.fn().mockResolvedValue({ status: 200, data: { subjects: ['Física', 'Cálculo II'] } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get });
  const signal = new AbortController().signal;

  await expect(getRecentStudySessionSubjects(signal)).resolves.toEqual(['Física', 'Cálculo II']);
  expect(get).toHaveBeenCalledWith('/sessions/subjects/recent', { signal });
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

  await expect(pauseStudySession({ id: 'study-1', expectedVersion: 4, idempotencyKey: 'pause-retry-key' })).resolves.toMatchObject({
    id: 'study-1', state: 'paused', receivedAtMs: expect.any(Number),
  });
  expect(post).toHaveBeenCalledWith('/sessions/study-1/pause', { expectedVersion: 4 }, {
    headers: { 'Idempotency-Key': 'pause-retry-key' },
  });
});

it('sends resume with the expected version and preserves its idempotency key', async () => {
  const post = jest.fn().mockResolvedValue({ data: { id: 'study-1', state: 'running' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });

  await expect(resumeStudySession({ id: 'study-1', expectedVersion: 5, idempotencyKey: 'resume-retry-key' })).resolves.toMatchObject({
    id: 'study-1', state: 'running', receivedAtMs: expect.any(Number),
  });
  expect(post).toHaveBeenCalledWith('/sessions/study-1/resume', { expectedVersion: 5 }, {
    headers: { 'Idempotency-Key': 'resume-retry-key' },
  });
});

it('sends stop with the expected version and preserves its idempotency key', async () => {
  const post = jest.fn().mockResolvedValue({ data: { id: 'study-1', state: 'cancelled' } });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ post });

  await expect(stopStudySession({ id: 'study-1', expectedVersion: 6, idempotencyKey: 'stop-retry-key' })).resolves.toMatchObject({
    id: 'study-1', state: 'cancelled', receivedAtMs: expect.any(Number),
  });
  expect(post).toHaveBeenCalledWith('/sessions/study-1/stop', { expectedVersion: 6 }, {
    headers: { 'Idempotency-Key': 'stop-retry-key' },
  });
});
