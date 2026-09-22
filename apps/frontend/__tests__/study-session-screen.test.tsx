import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { getActiveStudySession, heartbeatStudySession, startStudySession, type StudySessionSnapshot } from '@/features/study-session/api';
import { STUDY_SESSION_HEARTBEAT_INTERVAL_MS } from '@/features/study-session/use-study-session-heartbeat';
import { formatRemainingTime, remainingStudySeconds } from '@/features/study-session/timer';

jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  heartbeatStudySession: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const heartbeat = heartbeatStudySession as jest.MockedFunction<typeof heartbeatStudySession>;
const start = startStudySession as jest.MockedFunction<typeof startStudySession>;
let heartbeatTick: (() => void) | undefined;
let appStateListener: ((state: AppStateStatus) => void) | undefined;
let heartbeatIntervalId: ReturnType<typeof setInterval> | undefined;
const snapshot: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

async function renderStudySession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
}

beforeEach(() => {
  heartbeatTick = undefined;
  appStateListener = undefined;
  heartbeatIntervalId = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener);
  const originalSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === STUDY_SESSION_HEARTBEAT_INTERVAL_MS) {
      heartbeatTick = callback;
      heartbeatIntervalId = 123 as unknown as ReturnType<typeof setInterval>;
      return heartbeatIntervalId;
    }
    return delay === 1000 ? 0 as unknown as ReturnType<typeof setInterval> : originalSetInterval(callback, delay);
  }) as typeof setInterval);
  jest.spyOn(global, 'clearInterval');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('offers only three presets, starts with 25 minutes and sends the chosen duration', async () => {
  getActive.mockResolvedValue(null);
  start.mockResolvedValue(snapshot);
  const view = await renderStudySession();
  await screen.findByTestId('study-session-setup');

  expect(screen.getByTestId('study-duration-25').props.accessibilityState.checked).toBe(true);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  await fireEvent.press(screen.getByTestId('study-duration-15'));
  await waitFor(() => expect(screen.getByTestId('study-duration-15').props.accessibilityState.checked).toBe(true));
  await fireEvent.press(screen.getByTestId('study-session-start'));
  await waitFor(() => expect(start).toHaveBeenCalledWith(900, expect.any(String)));
  await screen.findByTestId('study-session-active');
  expect(screen.queryByTestId('study-session-setup')).toBeNull();
  view.unmount();
});

it('restores a controllable session and only informs about a remote session', async () => {
  getActive.mockResolvedValue(snapshot);
  heartbeat.mockResolvedValue(undefined);
  const view = await renderStudySession();
  await screen.findByTestId('study-session-active');
  await waitFor(() => expect(heartbeat).toHaveBeenCalledWith('study-1', expect.any(AbortSignal)));
  expect(setInterval).toHaveBeenCalledWith(expect.any(Function), STUDY_SESSION_HEARTBEAT_INTERVAL_MS);
  expect(heartbeatTick).toBeDefined();
  heartbeatTick?.();
  await waitFor(() => expect(heartbeat).toHaveBeenCalledTimes(2));

  await act(async () => { appStateListener?.('background'); });
  expect(clearInterval).toHaveBeenCalledWith(heartbeatIntervalId);
  heartbeatTick?.();
  expect(heartbeat).toHaveBeenCalledTimes(2);

  await act(async () => { appStateListener?.('active'); });
  await waitFor(() => expect(heartbeat).toHaveBeenCalledTimes(3));
  expect(screen.getByTestId('study-session-timer')).toBeTruthy();
  view.unmount();

  heartbeat.mockClear();
  getActive.mockResolvedValue({ ...snapshot, canControl: false });
  const remote = await renderStudySession();
  await screen.findByTestId('study-session-remote-conflict');
  expect(screen.queryByTestId('study-session-start')).toBeNull();
  expect(screen.queryByTestId('study-session-timer')).toBeNull();
  expect(heartbeat).not.toHaveBeenCalled();
  remote.unmount();
});

it('projects remaining time from the server deadline without changing the canonical snapshot', () => {
  expect(remainingStudySeconds(snapshot, new Date('2026-09-22T12:05:00.000Z').getTime(), 0)).toBe(1200);
  expect(formatRemainingTime(1200)).toBe('20:00');
  expect(snapshot.remainingSeconds).toBe(1500);
});
