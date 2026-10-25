import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { StudySessionHeartbeatRuntime } from '@/features/study-session/study-session-heartbeat-runtime';
import {
  completeStudySession,
  getActiveStudySession,
  type StudySessionTransitionResult,
} from '@/features/study-session/api';
import { clearCompletionIntent } from '@/features/study-session/completion-intent';
import { useStudySessionAppActive } from '@/features/study-session/use-study-session-app-active';
import { dashboardKeys } from '@/features/dashboard/queries';

// Without a Guild the Forja offers only solo sessions.
// The day history and the week chart have their own tests (forge-history.test.tsx).
jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(async () => null),
  getActiveRaid: jest.fn(async () => null),
  joinRaid: jest.fn(),
}));

jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  completeStudySession: jest.fn(),
  getActiveStudySession: jest.fn(),
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
const appActive = useStudySessionAppActive as jest.MockedFunction<typeof useStudySessionAppActive>;

let mockedNow: number;
let studySessionTimerTick: (() => void) | undefined;
const queryClients: QueryClient[] = [];
const snapshot: StudySessionTransitionResult = {
  id: 'study-1', mode: 'solo', raidId: null, subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true, raidContribution: null,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

function atZero(): StudySessionTransitionResult {
  return {
    ...snapshot,
    remainingSeconds: 0,
    runDeadlineAt: new Date(mockedNow).toISOString(),
    serverNow: new Date(mockedNow).toISOString(),
    receivedAtMs: mockedNow,
  };
}

function completed(base: StudySessionTransitionResult): StudySessionTransitionResult {
  return {
    ...base,
    state: 'completed',
    endedAt: base.runDeadlineAt,
    durationValidSeconds: base.plannedDurationSeconds as number,
    remainingSeconds: 0,
    xpAwarded: (base.plannedDurationSeconds as number) / 60 * 10,
    terminalReason: 'auto-complete',
  };
}

function completionRequest(callIndex = 0) {
  const call = complete.mock.calls[callIndex];
  if (!call) throw new Error(`Expected completion request ${callIndex + 1}`);
  return call[0];
}

async function renderStudySession(client?: QueryClient) {
  const queryClient = client ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  queryClients.push(queryClient);
  const renderTree = (showScreen: boolean) => (
    <QueryClientProvider client={queryClient}>
      {showScreen ? <StudySessionScreen /> : null}
    </QueryClientProvider>
  );
  const view = await render(renderTree(true));
  return {
    view,
    client: queryClient,
    setShowScreen: (showScreen: boolean) => view.rerender(renderTree(showScreen)),
  };
}

beforeEach(() => {
  clearCompletionIntent();
  mockedNow = new Date('2026-09-22T12:00:00.000Z').getTime();
  studySessionTimerTick = undefined;
  appActive.mockReturnValue(true);
  jest.spyOn(Date, 'now').mockImplementation(() => mockedNow);
  const nativeSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === 1000) {
      studySessionTimerTick = callback;
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

it('sends one completion at zero, blocks controls, and displays only the confirmed result', async () => {
  const zeroSnapshot = atZero();
  let resolveCompletion!: (result: StudySessionTransitionResult) => void;
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockImplementationOnce(() => new Promise((resolve) => { resolveCompletion = resolve; }));
  const { view, client } = await renderStudySession();

  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  const request = completionRequest();
  await view.findByText('Confirmando conclusão…');
  expect(view.getByTestId('study-session-timer').props.accessibilityLabel).toContain('0 minutos e 0 segundos');
  expect(view.queryByTestId('study-session-pause')).toBeNull();
  expect(view.queryByTestId('study-session-stop')).toBeNull();
  expect(view.queryByTestId('study-session-result')).toBeNull();
  expect(request).toEqual({ id: 'study-1', expectedVersion: 1, idempotencyKey: expect.any(String) });

  await act(async () => resolveCompletion(completed(zeroSnapshot)));
  await view.findByText('Sessão concluída');
  expect(view.getByText('Foco válido: 25:00')).toBeTruthy();
  expect(view.getByText('XP confirmado: 250')).toBeTruthy();
  expect(client.getQueryData(['study-session', 'active'])).toBeNull();
  view.unmount();
  client.clear();
});

it('retries a lost response with the same key', async () => {
  const zeroSnapshot = atZero();
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce(completed(zeroSnapshot));
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-completion-retry');
  const originalRequest = completionRequest();
  await fireEvent.press(view.getByRole('button', { name: 'Tentar confirmar novamente' }));

  await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
  expect(completionRequest(1)).toEqual(originalRequest);
  await view.findByText('Sessão concluída');
  view.unmount();
});

it('waits for a fresh zero projection after an early conflict and preserves the original key', async () => {
  const zeroSnapshot = atZero();
  const refreshedSnapshot: StudySessionTransitionResult = {
    ...zeroSnapshot,
    remainingSeconds: 12,
    runDeadlineAt: new Date(mockedNow + 12_000).toISOString(),
    receivedAtMs: mockedNow + 1,
  };
  getActive.mockResolvedValueOnce(zeroSnapshot).mockResolvedValueOnce(refreshedSnapshot);
  complete.mockRejectedValueOnce({
    response: { status: 409, data: { type: 'https://wise.app/errors/study-session-completion-too-early' } },
  }).mockResolvedValueOnce(completed(refreshedSnapshot));
  const { view } = await renderStudySession();

  await waitFor(() => expect(getActive).toHaveBeenCalledTimes(2));
  const originalRequest = completionRequest();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(view.getByTestId('study-session-timer').props.accessibilityLabel).toContain('0 minutos e 13 segundos');

  await act(async () => {
    mockedNow += 12_001;
    studySessionTimerTick?.();
  });
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
  expect(completionRequest(1)).toEqual(originalRequest);
  await view.findByText('Sessão concluída');
  view.unmount();
});

it('reuses the waiting intent after a failed reconciliation and a successful manual refresh', async () => {
  const zeroSnapshot = atZero();
  const refreshedSnapshot: StudySessionTransitionResult = {
    ...zeroSnapshot,
    remainingSeconds: 12,
    runDeadlineAt: new Date(mockedNow + 12_000).toISOString(),
    receivedAtMs: mockedNow + 1,
  };
  getActive
    .mockResolvedValueOnce(zeroSnapshot)
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce(refreshedSnapshot);
  complete.mockRejectedValueOnce({
    response: { status: 409, data: { type: 'https://wise.app/errors/study-session-completion-too-early' } },
  }).mockResolvedValueOnce(completed(refreshedSnapshot));
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-completion-refresh');
  const originalRequest = completionRequest();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(getActive).toHaveBeenCalledTimes(2);

  await fireEvent.press(view.getByRole('button', { name: 'Atualizar estado' }));
  await waitFor(() => expect(getActive).toHaveBeenCalledTimes(3));
  await waitFor(() => {
    expect(view.getByTestId('study-session-timer').props.accessibilityLabel).toContain('0 minutos e 13 segundos');
  });

  await act(async () => {
    mockedNow += 12_001;
    studySessionTimerTick?.();
  });
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
  expect(completionRequest(1)).toEqual(originalRequest);
  await view.findByText('Sessão concluída');
  view.unmount();
});

it('does not auto-complete in the background and reconciles on return', async () => {
  const zeroSnapshot = atZero();
  appActive.mockReturnValue(false);
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockResolvedValue(completed(zeroSnapshot));
  const { view, setShowScreen } = await renderStudySession();
  await view.findByTestId('study-session-active');
  expect(complete).not.toHaveBeenCalled();

  appActive.mockReturnValue(true);
  await act(async () => setShowScreen(true));
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  expect(getActive).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('shows the result the server completed on read when the device returns after the deadline', async () => {
  getActive.mockResolvedValueOnce(snapshot);
  const { view, client, setShowScreen } = await renderStudySession();
  await view.findByTestId('study-session-active');

  appActive.mockReturnValue(false);
  await act(async () => setShowScreen(true));
  mockedNow = new Date(snapshot.runDeadlineAt!).getTime() + 5 * 60 * 1000;
  getActive.mockResolvedValue(completed(snapshot));
  appActive.mockReturnValue(true);
  await act(async () => setShowScreen(true));

  await view.findByText('Sessão concluída');
  expect(view.getByText('XP confirmado: 250')).toBeTruthy();
  expect(complete).not.toHaveBeenCalled();
  // The read completed the focus here: the result takes the place of the remote-end warning.
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  expect(client.getQueryData(['study-session', 'active'])).toBeNull();
  view.unmount();
});

it('keeps the server result read by the app-wide runtime until the screen shows it', async () => {
  getActive.mockResolvedValueOnce(completed(atZero())).mockResolvedValue(null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queryClients.push(client);
  const tree = (showScreen: boolean) => (
    <QueryClientProvider client={client}>
      <StudySessionHeartbeatRuntime />
      {showScreen ? <StudySessionScreen /> : null}
    </QueryClientProvider>
  );
  const view = await render(tree(false));
  await waitFor(() => expect(getActive).toHaveBeenCalledTimes(1));

  await act(async () => view.rerender(tree(true)));

  await view.findByText('Sessão concluída');
  expect(view.getByText('XP confirmado: 250')).toBeTruthy();
  expect(complete).not.toHaveBeenCalled();
  view.unmount();
});

it('keeps the in-flight idempotent intent across a screen remount', async () => {
  const zeroSnapshot = atZero();
  let resolveCompletion!: (result: StudySessionTransitionResult) => void;
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockImplementationOnce(() => new Promise((resolve) => { resolveCompletion = resolve; }));
  const { view, client, setShowScreen } = await renderStudySession();

  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  await view.findByText('Confirmando conclusão…');
  await act(async () => setShowScreen(false));
  await act(async () => setShowScreen(true));
  await view.findByText('Confirmando conclusão…');
  expect(complete).toHaveBeenCalledTimes(1);

  await act(async () => resolveCompletion(completed(zeroSnapshot)));
  await view.findByText('Sessão concluída');
  view.unmount();
  client.clear();
});

it('shows a safe reason and zero XP when the server confirms a discarded session', async () => {
  const zeroSnapshot = atZero();
  const discardedSnapshot: StudySessionTransitionResult = {
    ...zeroSnapshot,
    state: 'discarded',
    endedAt: zeroSnapshot.runDeadlineAt,
    durationValidSeconds: 0,
    remainingSeconds: 0,
    xpAwarded: 0,
    terminalReason: 'auto-complete',
    discardedReason: 'daily-limit-exceeded',
  };
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockResolvedValue(discardedSnapshot);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 30_000 }, mutations: { retry: false, gcTime: 0 } },
  });
  client.setQueryData(dashboardKeys.profile(), { id: 'u-1', email: 'a@b.c', displayName: 'Knightshade', planTier: 'free', level: 14, levelStartXp: 0, nextLevelXp: 1000, xpTotal: 0, title: null, equipped: [] });
  client.setQueryData(dashboardKeys.recentActivity(), []);
  client.setQueryData(dashboardKeys.metrics(), { currentStreakDays: 0, longestStreakDays: 0, sessionsToday: 0, validSecondsToday: 0, cadence: { windowStart: '2026-09-16', windowEnd: '2026-09-22', days: [] } });
  const { view } = await renderStudySession(client);

  await view.findByText('Sessão não contabilizada');
  expect(view.getByText('O limite diário de foco foi atingido.')).toBeTruthy();
  expect(view.getByText('XP confirmado: 0')).toBeTruthy();
  await waitFor(() => {
    expect(client.getQueryState(dashboardKeys.profile())?.isInvalidated).toBe(true);
    expect(client.getQueryState(dashboardKeys.recentActivity())?.isInvalidated).toBe(true);
    expect(client.getQueryState(dashboardKeys.metrics())?.isInvalidated).toBe(true);
  });
  view.unmount();
  client.clear();
});

it('explains that the XP of a completed session was capped by the daily limit', async () => {
  const zeroSnapshot = atZero();
  const cappedSnapshot: StudySessionTransitionResult = {
    ...zeroSnapshot,
    state: 'completed',
    endedAt: zeroSnapshot.runDeadlineAt,
    durationValidSeconds: 600,
    remainingSeconds: 0,
    xpAwarded: 100,
    terminalReason: 'auto-complete',
    cappedReason: 'daily-limit',
  };
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockResolvedValue(cappedSnapshot);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 30_000 }, mutations: { retry: false, gcTime: 0 } },
  });
  const { view } = await renderStudySession(client);

  await view.findByText('Sessão concluída');
  expect(view.getByText('XP limitado pelo teto diário.')).toBeTruthy();
  expect(view.getByText('XP confirmado: 100')).toBeTruthy();
  view.unmount();
  client.clear();
});

it.each([
  [{ status: 'counted', xpContributed: 250 }, '+250 XP para a Raid da Guilda.'],
  [{ status: 'outside-raid-window', xpContributed: 0 }, 'Esta sessão não contou para a Raid: terminou fora da janela da Raid.'],
  [{ status: 'no-validated-xp', xpContributed: 0 }, 'Esta sessão não contou para a Raid: não houve XP validado.'],
] as const)('tells whether the Study Session counted for the Raid (%o)', async (raidContribution, message) => {
  const zeroSnapshot = atZero();
  getActive.mockResolvedValue(zeroSnapshot);
  complete.mockResolvedValue({ ...completed(zeroSnapshot), raidContribution });
  const { view } = await renderStudySession();

  await view.findByText('Sessão concluída');
  expect(view.getByTestId('study-session-result-raid-contribution')).toHaveTextContent(message);
  view.unmount();
});
