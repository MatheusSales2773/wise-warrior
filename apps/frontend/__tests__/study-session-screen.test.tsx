import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, processColor, type AppStateStatus } from 'react-native';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { StudySessionHeartbeatRuntime } from '@/features/study-session/study-session-heartbeat-runtime';
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
let appStateListeners: Array<(state: AppStateStatus) => void>;
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
  const renderTree = (showScreen: boolean) => (
    <QueryClientProvider client={client}>
      <StudySessionHeartbeatRuntime />
      {showScreen ? <StudySessionScreen /> : null}
    </QueryClientProvider>
  );
  const view = await render(renderTree(true));
  return { view, setShowScreen: (showScreen: boolean) => view.rerender(renderTree(showScreen)) };
}

beforeEach(() => {
  heartbeatTick = undefined;
  appStateListeners = [];
  heartbeatIntervalId = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener);
  const originalSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === STUDY_SESSION_HEARTBEAT_INTERVAL_MS) {
      heartbeatTick = callback;
      heartbeatIntervalId = 123 as unknown as ReturnType<typeof setInterval>;
      return heartbeatIntervalId;
    }
    if (delay === 1000) return 0 as unknown as ReturnType<typeof setInterval>;
    return originalSetInterval(callback, delay);
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
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-setup');

  await fireEvent.press(view.getByRole('button', { name: 'Configurar duração' }));
  expect(view.getByTestId('study-duration-25').props.accessibilityState.checked).toBe(true);
  expect(view.getAllByRole('radio')).toHaveLength(3);
  await fireEvent.press(view.getByTestId('study-duration-15'));
  await waitFor(() => expect(view.getByTestId('study-duration-15').props.accessibilityState.checked).toBe(true));
  await fireEvent.press(view.getByTestId('study-session-start'));
  await waitFor(() => expect(start).toHaveBeenCalledWith(900, expect.any(String)));
  await view.findByTestId('study-session-active');
  expect(view.queryByTestId('study-session-setup')).toBeNull();
  view.unmount();
});

it('configures focus duration from the gear before starting the forge', async () => {
  getActive.mockResolvedValue(null);
  start.mockResolvedValue(snapshot);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-setup');

  expect(view.queryByRole('radio')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Configurar duração' }));
  expect(view.getByRole('radio', { name: '25 minutos' }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(view.getByRole('radio', { name: '15 minutos' }));
  await fireEvent.press(view.getByRole('button', { name: 'Fechar configurações' }));
  expect(view.getByText('15:00')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Iniciar foco' }));
  await waitFor(() => expect(start).toHaveBeenCalledWith(900, expect.any(String)));
  view.unmount();
});

it('opens and closes the focus duration options by tapping the same gear', async () => {
  getActive.mockResolvedValue(null);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-setup');

  const gear = view.getByRole('button', { name: 'Configurar duração' });
  expect(view.queryByRole('radio')).toBeNull();
  await fireEvent.press(gear);
  expect(view.getAllByRole('radio')).toHaveLength(3);
  await fireEvent.press(gear);
  expect(view.queryByRole('radio')).toBeNull();
  view.unmount();
});

it('keeps the iPhone forge header and duration choices in the visible stage', async () => {
  getActive.mockResolvedValue(null);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-setup');

  expect(view.getByTestId('study-session-safe-area').props.edges.top).toBe('off');
  await fireEvent.press(view.getByRole('button', { name: 'Configurar duração' }));
  expect(within(view.getByTestId('study-session-stage')).getAllByRole('radio')).toHaveLength(3);
  view.unmount();
});

it('shows the fixed duration in settings during an active session', async () => {
  getActive.mockResolvedValue(snapshot);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-active');

  await fireEvent.press(view.getByRole('button', { name: 'Configurações da sessão' }));
  expect(view.getByText('A duração não pode ser alterada durante a sessão.')).toBeTruthy();
  expect(view.queryByRole('radio')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Fechar configurações' }));
  expect(view.queryByText('A duração não pode ser alterada durante a sessão.')).toBeNull();
  view.unmount();
});

it('renders the forge with a gold background glow and gold primary action', async () => {
  getActive.mockResolvedValue(snapshot);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-active');

  expect(view.getByTestId('study-session-page-gradient', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByTestId('study-session-stage-gradient', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByTestId('study-session-primary-gradient').props.colors).toEqual([processColor('#d4a85a'), processColor('#8a6a3a')]);
  view.unmount();
});

it('restores a controllable session and only informs about a remote session', async () => {
  getActive.mockResolvedValue(snapshot);
  heartbeat.mockResolvedValue(undefined);
  const { view, setShowScreen } = await renderStudySession();
  await view.findByTestId('study-session-active');
  await waitFor(() => expect(heartbeat).toHaveBeenCalledWith('study-1', expect.any(AbortSignal)));
  expect(setInterval).toHaveBeenCalledWith(expect.any(Function), STUDY_SESSION_HEARTBEAT_INTERVAL_MS);
  expect(heartbeatTick).toBeDefined();
  heartbeatTick?.();
  await waitFor(() => expect(heartbeat).toHaveBeenCalledTimes(2));

  await act(async () => { await setShowScreen(false); });
  heartbeatTick?.();
  await waitFor(() => expect(heartbeat).toHaveBeenCalledTimes(3));

  await act(async () => { appStateListeners.forEach((listener) => listener('background')); });
  expect(clearInterval).toHaveBeenCalledWith(heartbeatIntervalId);
  heartbeatTick?.();
  expect(heartbeat).toHaveBeenCalledTimes(3);

  await act(async () => { appStateListeners.forEach((listener) => listener('active')); });
  await waitFor(() => expect(heartbeat).toHaveBeenCalledTimes(4));
  view.unmount();

  heartbeat.mockClear();
  getActive.mockResolvedValue({ ...snapshot, canControl: false });
  const remote = await renderStudySession();
  await remote.view.findByTestId('study-session-remote-conflict');
  expect(remote.view.queryByTestId('study-session-start')).toBeNull();
  expect(remote.view.queryByTestId('study-session-timer')).toBeNull();
  expect(heartbeat).not.toHaveBeenCalled();
  remote.view.unmount();
});

it('projects remaining time from the server deadline without changing the canonical snapshot', () => {
  expect(remainingStudySeconds(snapshot, new Date('2026-09-22T12:05:00.000Z').getTime(), 0)).toBe(1200);
  expect(formatRemainingTime(1200)).toBe('20:00');
  expect(snapshot.remainingSeconds).toBe(1500);
});
