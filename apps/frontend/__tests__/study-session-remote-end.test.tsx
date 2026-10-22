import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import {
  getActiveStudySession,
  getRecentStudySessionSubjects,
  stopStudySession,
  type StudySessionSnapshot,
  type StudySessionTransitionResult,
} from '@/features/study-session/api';
import { activeStudySessionQueryKey } from '@/features/study-session/queries';
import { getActiveRaid, getMyGuild } from '@/features/guild/api';
import { devicePreferences } from '@/core/preferences/device-preferences';

// The day history and the week chart have their own tests (forge-history.test.tsx).
jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));
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
  pauseStudySession: jest.fn(),
  resumeStudySession: jest.fn(),
  stopStudySession: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const getRecent = getRecentStudySessionSubjects as jest.MockedFunction<typeof getRecentStudySessionSubjects>;
const getMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const getRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;
const stop = stopStudySession as jest.MockedFunction<typeof stopStudySession>;

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
  return { view, client };
}

/** The other device changed the session: the realtime event invalidated the active query, which refetched this. */
async function refetchActive(client: QueryClient, result: StudySessionSnapshot | null) {
  getActive.mockResolvedValue(result);
  await act(async () => {
    await client.refetchQueries({ queryKey: activeStudySessionQueryKey });
  });
}

beforeEach(async () => {
  // The stop confirmation has its own tests (study-session-controls); here the stop control sends the command at once.
  await devicePreferences.set('confirmBeforeStopping', false);
  getRecent.mockResolvedValue([]);
  getMine.mockResolvedValue(null);
  getRaid.mockResolvedValue(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove: jest.fn() })) as typeof AppState.addEventListener);
  // The running timer ticks each second; the test drives the snapshots instead.
  const originalSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === 1000) return 0 as unknown as ReturnType<typeof setInterval>;
    return originalSetInterval(callback, delay);
  }) as typeof setInterval);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('clears the session and warns when another device ends it', async () => {
  getActive.mockResolvedValue(snapshot);
  const { view, client } = await renderStudySession();
  await view.findByTestId('study-session-active');

  await refetchActive(client, null);

  const notice = await view.findByTestId('study-session-remote-end');
  expect(notice).toHaveTextContent('Sessão encerrada em outro dispositivo');
  expect(notice.props.accessibilityLiveRegion).toBe('polite');
  // Nothing to pause and no break to offer: no result came from this device.
  expect(view.queryByTestId('study-session-active')).toBeNull();
  expect(view.queryByTestId('study-session-result')).toBeNull();
  expect(view.queryByTestId('study-session-break-offer')).toBeNull();
  expect(view.getByTestId('study-session-setup')).toBeTruthy();
  view.unmount();
});

it('shows the session when another device starts one', async () => {
  getActive.mockResolvedValue(null);
  const { view, client } = await renderStudySession();
  await view.findByTestId('study-session-setup');

  await refetchActive(client, { ...snapshot, id: 'study-2' });

  await view.findByTestId('study-session-active');
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  view.unmount();
});

it('hides the warning once a new session appears', async () => {
  getActive.mockResolvedValue(snapshot);
  const { view, client } = await renderStudySession();
  await view.findByTestId('study-session-active');
  await refetchActive(client, null);
  await view.findByTestId('study-session-remote-end');

  await refetchActive(client, { ...snapshot, id: 'study-2' });

  await view.findByTestId('study-session-active');
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  view.unmount();
});

it('hides a warning that a racing event raised once the local result arrives', async () => {
  getActive.mockResolvedValue(snapshot);
  const { view, client } = await renderStudySession();
  await view.findByTestId('study-session-active');
  await refetchActive(client, null);
  await view.findByTestId('study-session-remote-end');

  // The read completes the expired focus: the query keeps the result aside and returns no active session.
  await refetchActive(client, {
    ...snapshot, state: 'completed', version: 2, endedAt: '2026-09-22T12:25:00.000Z',
    durationValidSeconds: 1500, remainingSeconds: 0, terminalReason: 'auto-complete',
    xpAwarded: 250,
    serverNow: '2026-09-22T12:25:00.000Z', receivedAtMs: new Date('2026-09-22T12:25:00.000Z').getTime(),
  });

  await view.findByText('Sessão concluída');
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  view.unmount();
});

it('keeps the normal result without the remote-end warning after a local stop', async () => {
  const stopped: StudySessionTransitionResult = {
    ...snapshot, state: 'stopped_early', endedAt: '2026-09-22T12:05:00.000Z',
    durationValidSeconds: 300, remainingSeconds: 0, terminalReason: 'manual-stop',
    xpAwarded: 50, version: 2, raidContribution: null,
    serverNow: '2026-09-22T12:05:00.000Z', receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  };
  getActive.mockResolvedValue({
    ...snapshot, remainingSeconds: 1200, runDeadlineAt: '2026-09-22T12:20:00.000Z',
    serverNow: '2026-09-22T12:05:00.000Z', receivedAtMs: new Date('2026-09-22T12:05:00.000Z').getTime(),
  });
  stop.mockResolvedValue(stopped);
  const { view } = await renderStudySession();
  await view.findByTestId('study-session-active');

  await fireEvent.press(view.getByRole('button', { name: 'Encerrar antecipadamente' }));

  await view.findByTestId('study-session-result');
  expect(view.getByText('Sessão encerrada antecipadamente')).toBeTruthy();
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  view.unmount();
});

it('does not warn on the first empty read of the Forja', async () => {
  getActive.mockResolvedValue(null);
  const { view } = await renderStudySession();

  await view.findByTestId('study-session-setup');
  expect(view.queryByTestId('study-session-remote-end')).toBeNull();
  view.unmount();
});
