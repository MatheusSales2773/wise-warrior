import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import {
  completeStudySession,
  getActiveStudySession,
  getFocusCycle,
  stopStudySession,
  type FocusCycle,
  type StudySessionSnapshot,
  type StudySessionTransitionResult,
} from '@/features/study-session/api';
import { clearCompletionIntent } from '@/features/study-session/completion-intent';
import { stopSessionSounds } from '@/features/study-session/sounds';
import { useStudySessionAppActive } from '@/features/study-session/use-study-session-app-active';
import { devicePreferences } from '@/core/preferences/device-preferences';

// The day history and the week chart have their own tests (forge-history.test.tsx).
jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));
jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(async () => null),
  getActiveRaid: jest.fn(async () => null),
  joinRaid: jest.fn(),
}));

jest.mock('@/features/study-session/sounds', () => ({
  playSessionSound: jest.fn(), releaseSessionSounds: jest.fn(), stopSessionSounds: jest.fn(), unlockSessionSounds: jest.fn(),
}));
jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  completeStudySession: jest.fn(),
  getActiveStudySession: jest.fn(),
  getFocusCycle: jest.fn(),
  getRecentStudySessionSubjects: jest.fn().mockResolvedValue([]),
  heartbeatStudySession: jest.fn(),
  pauseStudySession: jest.fn(),
  resumeStudySession: jest.fn(),
  startStudySession: jest.fn(),
  stopStudySession: jest.fn(),
}));
jest.mock('@/features/study-session/use-study-session-app-active', () => ({
  useStudySessionAppActive: jest.fn(() => true),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const complete = completeStudySession as jest.MockedFunction<typeof completeStudySession>;
const stop = stopStudySession as jest.MockedFunction<typeof stopStudySession>;
const cycle = getFocusCycle as jest.MockedFunction<typeof getFocusCycle>;
const appActive = useStudySessionAppActive as jest.MockedFunction<typeof useStudySessionAppActive>;

let mockedNow: number;
let timerTick: (() => void) | undefined;
const queryClients: QueryClient[] = [];
const running: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', raidId: null, subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

function atZero(): StudySessionSnapshot {
  return {
    ...running,
    remainingSeconds: 0,
    runDeadlineAt: new Date(mockedNow).toISOString(),
    serverNow: new Date(mockedNow).toISOString(),
    receivedAtMs: mockedNow,
  };
}

const completedResult = (): StudySessionTransitionResult => ({
  ...atZero(), raidContribution: null, state: 'completed', endedAt: new Date(mockedNow).toISOString(),
  durationValidSeconds: 1500, xpAwarded: 250, terminalReason: 'auto-complete',
});

const inCycle = (completedInCycle: number): FocusCycle => ({
  completedInCycle,
  cycleLength: 4,
  nextBreak: completedInCycle === 4 ? 'long' : 'short',
});

async function renderCompletedFocus(focusCycle: FocusCycle) {
  getActive.mockResolvedValue(atZero());
  complete.mockResolvedValue(completedResult());
  cycle.mockResolvedValue(focusCycle);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  queryClients.push(queryClient);
  const view = await render(<QueryClientProvider client={queryClient}><StudySessionScreen /></QueryClientProvider>);
  await view.findByText('Sessão concluída');
  return view;
}

const advance = (seconds: number) => act(async () => {
  mockedNow += seconds * 1000;
  timerTick?.();
});

beforeEach(async () => {
  // The stop confirmation has its own tests (study-session-controls); here the stop control sends the command at once.
  await devicePreferences.set('confirmBeforeStopping', false);
  clearCompletionIntent();
  mockedNow = new Date('2026-09-22T12:00:00.000Z').getTime();
  timerTick = undefined;
  appActive.mockReturnValue(true);
  jest.spyOn(Date, 'now').mockImplementation(() => mockedNow);
  const nativeSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === 1000) {
      timerTick = callback;
      return 0 as unknown as ReturnType<typeof setInterval>;
    }
    return nativeSetInterval(callback, delay);
  }) as typeof setInterval);
});

afterEach(() => {
  clearCompletionIntent();
  queryClients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('offers the short break after a completed focus and shows the cycle position', async () => {
  const view = await renderCompletedFocus(inCycle(2));

  await view.findByText('Forja 2 de 4');
  expect(view.getByText('Pausa curta de 5 minutos. Não concede XP.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Iniciar pausa curta' })).toBeTruthy();
  expect(view.getByTestId('study-session-new')).toBeTruthy();
});

it('offers the long break once four focuses are completed', async () => {
  const view = await renderCompletedFocus(inCycle(4));

  await view.findByText('Forja 4 de 4');
  expect(view.getByText('Quatro focos concluídos. Pausa longa de 15 minutos, sem XP.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Iniciar pausa longa' })).toBeTruthy();
});

it('falls back to the short break when the cycle cannot be loaded', async () => {
  getActive.mockResolvedValue(atZero());
  complete.mockResolvedValue(completedResult());
  cycle.mockRejectedValue(new Error('offline'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queryClients.push(queryClient);
  const view = await render(<QueryClientProvider client={queryClient}><StudySessionScreen /></QueryClientProvider>);

  await view.findByText('Sessão concluída');
  expect(await view.findByRole('button', { name: 'Iniciar pausa curta' })).toBeTruthy();
  expect(view.queryByText(/^Forja \d de 4$/)).toBeNull();
});

it('runs the break as a countdown, to the second, and completes it without XP', async () => {
  const view = await renderCompletedFocus(inCycle(1));
  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa curta' }));

  expect(view.getByTestId('study-session-break-timer').props.children).toBe('05:00');
  expect(view.getByText('◈ PAUSA CURTA ◈')).toBeTruthy();
  expect(view.queryByTestId('study-session-result')).toBeNull();

  await advance(61);
  expect(view.getByTestId('study-session-break-timer').props.children).toBe('03:59');

  await advance(239);
  expect(view.getByTestId('study-session-break-timer').props.children).toBe('00:00');
  expect(view.getByText('Pausa concluída. Pronto para outra forja?')).toBeTruthy();
  expect(view.queryByTestId('study-session-break-skip')).toBeNull();

  await fireEvent.press(view.getByTestId('study-session-break-new'));
  await view.findByTestId('study-session-setup');
});

it('runs the long break for 15 minutes', async () => {
  const view = await renderCompletedFocus(inCycle(4));
  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa longa' }));

  expect(view.getByTestId('study-session-break-timer').props.children).toBe('15:00');
  expect(view.getByText('◈ PAUSA LONGA ◈')).toBeTruthy();
});

it('skips a running break and returns to the setup without touching the cycle', async () => {
  const view = await renderCompletedFocus(inCycle(1));
  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa curta' }));
  const cycleCalls = cycle.mock.calls.length;

  await fireEvent.press(view.getByTestId('study-session-break-skip'));

  await view.findByTestId('study-session-setup');
  expect(cycle.mock.calls.length).toBe(cycleCalls);
});

it('does not offer a break after an early stop', async () => {
  getActive.mockResolvedValue({ ...running, remainingSeconds: 600, runDeadlineAt: new Date(mockedNow + 600_000).toISOString() });
  stop.mockResolvedValue({ ...running, raidContribution: null, state: 'stopped_early', durationValidSeconds: 900, xpAwarded: 150, terminalReason: 'manual-stop' });
  cycle.mockResolvedValue(inCycle(1));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queryClients.push(queryClient);
  const view = await render(<QueryClientProvider client={queryClient}><StudySessionScreen /></QueryClientProvider>);

  await fireEvent.press(await view.findByTestId('study-session-stop'));
  await view.findByText('Sessão encerrada antecipadamente');
  await waitFor(() => expect(view.queryByRole('button', { name: /Iniciar pausa/ })).toBeNull());
});

it('drops the break when a session is started on another device', async () => {
  const view = await renderCompletedFocus(inCycle(1));
  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa curta' }));
  expect(view.getByTestId('study-session-break')).toBeTruthy();

  const client = queryClients[0];
  if (!client) throw new Error('Expected a query client');
  getActive.mockResolvedValue({ ...running, id: 'study-2', canControl: false });
  await act(async () => { await client.invalidateQueries({ queryKey: ['study-session', 'active'] }); });

  await view.findByTestId('study-session-timer');
  expect(view.queryByText('Sessão concluída')).toBeNull();
  expect(view.getByTestId('study-session-pause')).toBeTruthy();
  expect(view.queryByTestId('study-session-break')).toBeNull();
  expect(client.getQueryData(['study-session', 'break'])).toBeUndefined();
});

it('silences the alarm when a break starts and when a new session is chosen', async () => {
  const view = await renderCompletedFocus(inCycle(1));
  (stopSessionSounds as jest.Mock).mockClear();

  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa curta' }));
  expect(stopSessionSounds).toHaveBeenCalledTimes(1);

  await fireEvent.press(view.getByTestId('study-session-break-skip'));
  expect(stopSessionSounds).toHaveBeenCalledTimes(2);
});

it('silences the alarm when the finished break hands over to a new session', async () => {
  const view = await renderCompletedFocus(inCycle(1));
  await fireEvent.press(await view.findByRole('button', { name: 'Iniciar pausa curta' }));
  await advance(300);
  (stopSessionSounds as jest.Mock).mockClear();

  await fireEvent.press(await view.findByRole('button', { name: 'Nova sessão' }));

  expect(stopSessionSounds).toHaveBeenCalledTimes(1);
});
