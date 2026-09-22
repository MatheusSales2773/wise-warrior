import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { getActiveStudySession, startStudySession, type StudySessionSnapshot } from '@/features/study-session/api';
import { formatRemainingTime, remainingStudySeconds } from '@/features/study-session/timer';

jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const start = startStudySession as jest.MockedFunction<typeof startStudySession>;
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
  const originalSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) =>
    delay === 1000 ? 0 : originalSetInterval(callback, delay)) as typeof setInterval);
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
  const view = await renderStudySession();
  await screen.findByTestId('study-session-active');
  expect(screen.getByTestId('study-session-timer')).toBeTruthy();
  view.unmount();

  getActive.mockResolvedValue({ ...snapshot, canControl: false });
  const remote = await renderStudySession();
  await screen.findByTestId('study-session-remote-conflict');
  expect(screen.queryByTestId('study-session-start')).toBeNull();
  expect(screen.queryByTestId('study-session-timer')).toBeNull();
  remote.unmount();
});

it('projects remaining time from the server deadline without changing the canonical snapshot', () => {
  expect(remainingStudySeconds(snapshot, new Date('2026-09-22T12:05:00.000Z').getTime(), 0)).toBe(1200);
  expect(formatRemainingTime(1200)).toBe('20:00');
  expect(snapshot.remainingSeconds).toBe(1500);
});
