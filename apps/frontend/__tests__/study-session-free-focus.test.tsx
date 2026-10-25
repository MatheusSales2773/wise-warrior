import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { getActiveStudySession, getRecentStudySessionSubjects, startStudySession, type StudySessionSnapshot } from '@/features/study-session/api';
import { elapsedStudySeconds, formatElapsedTime } from '@/features/study-session/timer';
import { ApiError } from '@/core/api/api-error';

jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(async () => { throw new Error('offline'); }),
  getSessionMetrics: jest.fn(async () => { throw new Error('offline'); }),
  getSessionHistory: jest.fn(async () => ({ items: [], nextCursor: null })),
  getRecentStudySessions: jest.fn(async () => []),
}));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(async () => null),
  getActiveRaid: jest.fn(async () => null),
  joinRaid: jest.fn(),
}));
jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));
jest.mock('@/features/study-session/sounds', () => ({
  playSessionSound: jest.fn(), releaseSessionSounds: jest.fn(), stopSessionSounds: jest.fn(), unlockSessionSounds: jest.fn(),
}));
jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  getRecentStudySessionSubjects: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const getRecent = getRecentStudySessionSubjects as jest.MockedFunction<typeof getRecentStudySessionSubjects>;
const start = startStudySession as jest.MockedFunction<typeof startStudySession>;

const freeRunning: StudySessionSnapshot = {
  id: 'study-1', kind: 'free', mode: 'solo', raidId: null, subject: null, state: 'running', plannedDurationSeconds: null,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T14:00:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 125, remainingSeconds: 0,
  serverNow: '2026-09-22T12:02:05.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:02:05.000Z').getTime(),
};

async function renderStudySession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
}

beforeEach(() => {
  getRecent.mockResolvedValue([]);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Foco livre on the Forja', () => {
  it('starts a Foco livre without a planned duration when Livre is picked', async () => {
    getActive.mockResolvedValue(null);
    start.mockResolvedValue(freeRunning);
    const view = await renderStudySession();
    await view.findByTestId('study-session-setup');

    await fireEvent.press(view.getByTestId('study-duration-free'));
    await waitFor(() => expect(view.getByTestId('study-duration-free').props.accessibilityState.checked).toBe(true));
    expect(view.getByText('00:00')).toBeTruthy();
    expect(view.getByText('conta até você parar')).toBeTruthy();
    await fireEvent.press(view.getByTestId('study-session-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith('free', expect.any(String), null));
    await view.findByTestId('study-session-active');
    view.unmount();
  });

  it('counts up from the snapshot and does not complete the session on its own', async () => {
    getActive.mockResolvedValue(freeRunning);
    const view = await renderStudySession();

    const timer = await view.findByTestId('study-session-timer');
    expect(timer).toHaveTextContent('02:05');
    expect(timer.props.accessibilityLabel).toBe('Tempo de foco: 0 horas, 2 minutos e 5 segundos. Foco livre em andamento.');
    expect(view.getByText('foco válido 02:05')).toBeTruthy();
    expect(view.getByTestId('study-session-strip-planned')).toHaveTextContent('Livretipo');
    expect(view.getByTestId('study-session-pause')).toBeTruthy();
    view.unmount();
  });

  it('freezes the elapsed time while paused', async () => {
    getActive.mockResolvedValue({ ...freeRunning, state: 'paused', pausedAt: freeRunning.serverNow, version: 2 });
    const view = await renderStudySession();

    expect(await view.findByTestId('study-session-timer')).toHaveTextContent('02:05');
    expect(view.getByTestId('study-session-resume')).toBeTruthy();
    view.unmount();
  });

  it('explains the daily limit when the start answers 409 daily-limit-reached', async () => {
    getActive.mockResolvedValue(null);
    start.mockRejectedValue(new ApiError('conflict', { status: 409, problemType: 'https://wise.app/errors/daily-limit-reached' }));
    const view = await renderStudySession();
    await view.findByTestId('study-session-setup');

    await fireEvent.press(view.getByTestId('study-duration-free'));
    await fireEvent.press(view.getByTestId('study-session-start'));

    expect(await view.findByTestId('study-session-daily-limit')).toHaveTextContent(/Limite diário de foco atingido/);
    view.unmount();
  });
});

describe('Foco livre timer', () => {
  const free = { ...freeRunning, durationValidSeconds: 60, serverNow: '2026-09-22T12:01:00.000Z', runDeadlineAt: '2026-09-22T12:10:00.000Z' };
  const at = (iso: string) => new Date(iso).getTime();

  it('adds the time since the snapshot to the valid focus, up to the antifraude ceiling', () => {
    expect(elapsedStudySeconds(free, at('2026-09-22T12:01:30.000Z'), 0)).toBe(90);
    expect(elapsedStudySeconds(free, at('2026-09-22T12:30:00.000Z'), 0)).toBe(60 + 540);
    expect(elapsedStudySeconds({ ...free, state: 'paused' }, at('2026-09-22T12:05:00.000Z'), 0)).toBe(60);
    expect(elapsedStudySeconds(free, at('2026-09-22T12:01:30.000Z'), -10_000)).toBe(80);
  });

  it('formats hours only from the first hour', () => {
    expect(formatElapsedTime(125)).toBe('02:05');
    expect(formatElapsedTime(3725)).toBe('1:02:05');
  });
});
