import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { getActiveStudySession, getRecentStudySessionSubjects, type StudySessionSnapshot } from '@/features/study-session/api';
import { ApiError } from '@/core/api/api-error';
import { getActiveRaid, getMyGuild } from '@/features/guild/api';

// The day history and the week chart have their own tests (forge-history.test.tsx).
jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
  joinRaid: jest.fn(),
}));
jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  getRecentStudySessionSubjects: jest.fn(),
  heartbeatStudySession: jest.fn(() => Promise.resolve()),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const getRecent = getRecentStudySessionSubjects as jest.MockedFunction<typeof getRecentStudySessionSubjects>;
const getMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const getRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;

let appStateListeners: Array<(state: AppStateStatus) => void>;

const snapshot: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', raidId: null, subject: null, state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

async function renderStudySession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
  return { view };
}

beforeEach(() => {
  getRecent.mockResolvedValue([]);
  getMine.mockResolvedValue(null);
  getRaid.mockResolvedValue(null);
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('connection state on the Forja (#17)', () => {
  afterEach(() => { onlineManager.setOnline(true); });

  it('says the running session is in sync with the server', async () => {
    getActive.mockResolvedValue(snapshot);
    const { view } = await renderStudySession();

    expect(await view.findByTestId('study-session-sync-online')).toBeTruthy();
    expect(view.getByTestId('study-session-sync-label')).toHaveTextContent('Sincronizado');
    view.unmount();
  });

  it('shows no connection state before any session exists', async () => {
    getActive.mockResolvedValue(null);
    const { view } = await renderStudySession();

    await view.findByTestId('study-session-setup');
    expect(view.queryByTestId('study-session-sync-label')).toBeNull();
    view.unmount();
  });

  it('turns offline when the network drops and reconciles with the server when it comes back', async () => {
    getActive.mockResolvedValue(snapshot);
    const { view } = await renderStudySession();
    await view.findByTestId('study-session-sync-online');
    const callsBefore = getActive.mock.calls.length;

    await act(async () => { onlineManager.setOnline(false); });
    expect(await view.findByTestId('study-session-sync-offline')).toBeTruthy();
    expect(view.getByText(/O tempo continua contando no servidor/)).toBeTruthy();
    expect(view.getByTestId('study-session-active')).toBeTruthy();

    await act(async () => { onlineManager.setOnline(true); });
    await waitFor(() => expect(getActive.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await view.findByTestId('study-session-sync-online')).toBeTruthy();
    view.unmount();
  });

  it('reports a failed reconciliation, keeps the last confirmed session and syncs again on demand', async () => {
    // A deadline in the future: returning to the foreground must not complete the focus on its own.
    const nowMs = Date.now();
    const live = {
      ...snapshot,
      startedAt: new Date(nowMs).toISOString(), runDeadlineAt: new Date(nowMs + 25 * 60_000).toISOString(),
      serverNow: new Date(nowMs).toISOString(), receivedAtMs: nowMs,
    };
    getActive.mockResolvedValue(live);
    const { view } = await renderStudySession();
    await view.findByTestId('study-session-sync-online');

    getActive.mockRejectedValueOnce(new ApiError('server', { status: 503 }));
    await act(async () => { appStateListeners.forEach((listener) => listener('background')); });
    await act(async () => { appStateListeners.forEach((listener) => listener('active')); });

    expect(await view.findByTestId('study-session-sync-failed')).toBeTruthy();
    expect(view.getByTestId('study-session-active')).toBeTruthy();

    await fireEvent.press(view.getByTestId('study-session-sync-retry'));
    expect(await view.findByTestId('study-session-sync-online')).toBeTruthy();
    view.unmount();
  });
});
