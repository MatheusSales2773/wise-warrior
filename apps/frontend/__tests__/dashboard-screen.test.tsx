import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform } from 'react-native';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { getMyProfile, getRecentStudySessions, type UserProfile, type RecentStudySession } from '@/features/dashboard/api';
import { dashboardKeys } from '@/features/dashboard/queries';

jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
}));

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
};
const session: RecentStudySession = {
  id: 'session-1', subject: 'Matemática', mode: 'foco', startedAt: '2026-09-16T18:00:00Z',
  endedAt: '2026-09-16T18:25:00Z', durationValidSeconds: 1500, xpAwarded: 25, discardedReason: null,
};

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedActivity = getRecentStudySessions as jest.MockedFunction<typeof getRecentStudySessions>;

async function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return { ...view, client };
}

afterEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
});

describe('DashboardScreen', () => {
  it('shows a blocking profile error and retries the profile request', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByText('Painel indisponível')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-profile')).toBeTruthy());
    expect(mockedProfile).toHaveBeenCalledTimes(2);
  });

  it('renders profile progress and recent activity, including discarded reason', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([{ ...session, discardedReason: 'too_short' }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByText('Boas-vindas, Aventureiro')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 4' }).props.accessibilityValue).toEqual({ min: 100, max: 200, now: 150 });
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Sessão não contabilizada')).toBeTruthy();
  });

  it('shows empty activity and keeps profile visible when activity fails after profile succeeds', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValue(new Error('activity offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile')).toBeTruthy();
    expect(screen.getByText('Alguns dados não foram atualizados.')).toBeTruthy();
    mockedActivity.mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
  });

  it('keeps cached activity and offers retry when a background refresh fails', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([session]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());

    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-refresh-error')).toBeTruthy());
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });

  it('single-flights repeated activity retries', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());

    let resolveRetry!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRetry = resolve; }));
    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });
    await act(() => { fireEvent.press(retryButton); });
    await act(() => { fireEvent.press(retryButton); });
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    await act(async () => { resolveRetry([]); });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
  });

  it('announces success after an isolated activity retry on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([session]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());

    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-refresh-error')).toBeTruthy());
    announce.mockClear();

    let resolveRetry!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRetry = resolve; }));
    await act(() => { fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Atualizando dados', { queue: true }));
    await act(async () => { resolveRetry([]); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Dados atualizados', { queue: true }));
    expect(announce.mock.calls.filter(([message]) => message === 'Dados atualizados')).toHaveLength(1);
    announce.mockRestore();
  });

  it('shows success after an external activity refetch completes', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([]);
    const { client } = await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    let resolveRefetch!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRefetch = resolve; }));
    await act(() => { void client.invalidateQueries({ queryKey: dashboardKeys.recentActivity() }); });
    await waitFor(() => expect(screen.getByText('Atualizando dados')).toBeTruthy());
    await act(async () => { resolveRefetch([]); });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
    client.clear();
  });

  it('announces dashboard status changes once on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    announce.mockClear();

    let resolveProfile!: (value: UserProfile) => void;
    let resolveActivity!: (value: RecentStudySession[]) => void;
    mockedProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Atualizando dados', { queue: true }));
    await act(async () => { resolveProfile(profile); resolveActivity([]); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Dados atualizados', { queue: true }));
    expect(announce.mock.calls.filter(([message]) => message === 'Atualizando dados')).toHaveLength(1);
    announce.mockRestore();
  });

  it('does not start duplicate requests while a manual refresh is pending', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    let resolveProfile!: (value: UserProfile) => void;
    let resolveActivity!: (value: RecentStudySession[]) => void;
    mockedProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveProfile(profile);
      resolveActivity([]);
    });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
  });

  it('displays loading state before the initial profile response', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();
    expect(screen.getByText('Carregando seu painel…')).toBeTruthy();
    expect(screen.getByTestId('dashboard-loading').props.accessibilityState).toEqual({ busy: true });
  });

  it('exposes a web refresh action and announces background refresh', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    const { client } = await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    let resolveProfileRefresh!: (value: UserProfile) => void;
    let resolveActivityRefresh!: (value: RecentStudySession[]) => void;
    const profileRefresh = new Promise<UserProfile>((resolve) => { resolveProfileRefresh = resolve; });
    const activityRefresh = new Promise<RecentStudySession[]>((resolve) => { resolveActivityRefresh = resolve; });
    mockedProfile.mockReturnValue(profileRefresh);
    mockedActivity.mockReturnValue(activityRefresh);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByText('Atualizando dados')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Atualizar dados' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await act(async () => {
      resolveProfileRefresh(profile);
      resolveActivityRefresh([]);
    });
    client.clear();
  });

  it('announces successful manual refresh completion', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
  });
});
