import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudySessionSoundRuntime } from '@/features/study-session/study-session-sound-runtime';
import { getActiveStudySession, type StudySessionSnapshot } from '@/features/study-session/api';
import { clearBreak, startBreak } from '@/features/study-session/pomodoro-break';
import { playSessionSound, releaseSessionSounds } from '@/features/study-session/sounds';

jest.mock('@/features/study-session/sounds', () => ({ playSessionSound: jest.fn(), releaseSessionSounds: jest.fn() }));
jest.mock('@/features/study-session/api', () => ({ getActiveStudySession: jest.fn() }));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const play = playSessionSound as jest.Mock;
const T0 = new Date('2026-09-22T12:00:00.000Z').getTime();

const running = (secondsLeft: number, extra: Partial<StudySessionSnapshot> = {}): StudySessionSnapshot => ({
  id: 'study-1', mode: 'solo', raidId: null, subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: new Date(T0).toISOString(), runDeadlineAt: new Date(T0 + secondsLeft * 1000).toISOString(),
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: secondsLeft,
  serverNow: new Date(T0).toISOString(), version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true, receivedAtMs: T0, ...extra,
});

let client: QueryClient;
async function mount() {
  const view = await render(<QueryClientProvider client={client}><StudySessionSoundRuntime /></QueryClientProvider>);
  // Let the initial read of the active session settle, so a later cache write is not overwritten by it.
  await waitFor(() => expect(client.getQueryState(['study-session', 'active'])?.status).toBe('success'));
  await act(async () => { await jest.advanceTimersByTimeAsync(0); });
  return view;
}
// Cache writes reach React on a timer, and act applies the render when it exits: settle them in their own act.
const change = (write: () => void) => act(async () => { write(); await jest.advanceTimersByTimeAsync(0); });
const advance = (seconds: number) => act(async () => { await jest.advanceTimersByTimeAsync(seconds * 1000); });

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

it('rings the focus cue in a loop when the deadline arrives, without any 1 s tick', async () => {
  getActive.mockResolvedValue(running(60));
  await mount();

  await advance(59);
  expect(play).not.toHaveBeenCalled();
  await advance(1);

  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith('focusEnd', { loop: true });
});

it('uses the server clock offset to place the deadline', async () => {
  getActive.mockResolvedValue(running(60, { serverNow: new Date(T0 + 10_000).toISOString() }));
  await mount();

  await advance(49);
  expect(play).not.toHaveBeenCalled();
  await advance(1);
  expect(play).toHaveBeenCalledTimes(1);
});

it('stays silent for a focus whose deadline already passed before mounting', async () => {
  getActive.mockResolvedValue(running(-5));
  await mount();
  await advance(120);

  expect(play).not.toHaveBeenCalled();
});

it('does not ring a focus that was paused, and rearms on resume', async () => {
  getActive.mockResolvedValue(running(60));
  await mount();
  await change(() => { client.setQueryData(['study-session', 'active'], running(0, { state: 'paused', runDeadlineAt: null, remainingSeconds: 30 })); });
  await advance(120);
  expect(play).not.toHaveBeenCalled();

  await change(() => { client.setQueryData(['study-session', 'active'], running(30, {
    version: 3, serverNow: new Date().toISOString(), receivedAtMs: Date.now(),
    runDeadlineAt: new Date(Date.now() + 30_000).toISOString(),
  })); });
  await advance(30);
  expect(play).toHaveBeenCalledTimes(1);
});

it('does not ring a focus that was stopped before its deadline', async () => {
  getActive.mockResolvedValue(running(60));
  await mount();
  await change(() => { client.setQueryData(['study-session', 'active'], null); });
  await advance(120);

  expect(play).not.toHaveBeenCalled();
});

it('rings the break cue when a break started elsewhere in the app runs out', async () => {
  getActive.mockResolvedValue(null);
  await mount();
  await change(() => { startBreak(client, 'short', T0); });

  await advance(299);
  expect(play).not.toHaveBeenCalled();
  await advance(1);

  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith('breakEnd', { loop: true });
});

it('does not ring a break that was skipped, nor one that ended before mounting', async () => {
  getActive.mockResolvedValue(null);
  startBreak(client, 'short', T0 - 400_000);
  await mount();
  await advance(10);
  expect(play).not.toHaveBeenCalled();

  await change(() => { startBreak(client, 'short', Date.now()); });
  await change(() => { clearBreak(client); });
  await advance(400);
  expect(play).not.toHaveBeenCalled();
});

it('releases the players on unmount', async () => {
  getActive.mockResolvedValue(null);
  const view = await mount();

  await view.unmount();

  expect(releaseSessionSounds).toHaveBeenCalledTimes(1);
});
