import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform } from 'react-native';
import { theme } from '@/design-system';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { getMyProfile, getRecentStudySessions, getSessionMetrics, type UserProfile, type RecentStudySession, type SessionMetrics } from '@/features/dashboard/api';
import { dashboardKeys } from '@/features/dashboard/queries';

const mockUseWindowDimensions = jest.fn(() => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, {
    get(target, property, receiver) {
      return property === 'useWindowDimensions' ? mockUseWindowDimensions : Reflect.get(target, property, receiver);
    },
  });
});

jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
  getSessionMetrics: jest.fn(),
}));

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
};
const session: RecentStudySession = {
  id: 'session-1', subject: 'Matemática', mode: 'foco', startedAt: '2026-09-16T18:00:00Z',
  endedAt: '2026-09-16T18:25:00Z', durationValidSeconds: 1500, xpAwarded: 25, discardedReason: null,
};
const cadenceStart = new Date('2026-07-24T00:00:00.000Z');
const metrics: SessionMetrics = {
  currentStreakDays: 4, longestStreakDays: 9, sessionsToday: 2, dailyGoal: 4, validSecondsToday: 3_600,
  cadence: { windowStart: '2026-07-24', windowEnd: '2026-09-17', days: Array.from({ length: 56 }, (_, index) => {
    const date = new Date(cadenceStart);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), sessionCount: index % 3, validSeconds: (index % 3) * 900, intensity: (index % 5) as 0 | 1 | 2 | 3 | 4 };
  }) },
};

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedActivity = getRecentStudySessions as jest.MockedFunction<typeof getRecentStudySessions>;
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;

async function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  mockedMetrics.mockResolvedValue(metrics);
});

afterEach(() => {
  jest.clearAllMocks();
  mockUseWindowDimensions.mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 });
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
});

describe('DashboardScreen', () => {
  it('uses the AppShell safe-area contract and keeps the loading progressbar queryable', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();

    expect(screen.getByTestId('dashboard-safe-area').props.edges).toEqual({ top: 'off', right: 'off', bottom: 'off', left: 'off' });
    expect(screen.getByRole('progressbar', { name: 'Carregando seu painel', busy: true })).toBeTruthy();
  });

  it('exposes loading as a busy indeterminate progressbar', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();

    expect(screen.getByRole('progressbar', { name: 'Carregando seu painel', busy: true }).props.accessibilityValue)
      .toEqual({ min: 0, max: 100 });
  });

  it.each(['ios', 'android'] as const)('keeps the dashboard stacked on %s at wide widths', async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    mockUseWindowDimensions.mockReturnValue({ width: 1200, height: 800, scale: 1, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'column' })]));
  });

  it('keeps card content padded and columns shrinkable', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 320, height: 700, scale: 1, fontScale: 1.4 });
    mockedProfile.mockResolvedValue({ ...profile, displayName: 'Aventureiro com um nome muito comprido para a viewport' });
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-profile-content')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile-content').props.style).toEqual(expect.objectContaining({ padding: theme.space.cardInset }));
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '100%', flexDirection: 'column' })]));
    expect(screen.getByTestId('dashboard-main-column').props.style).toEqual(expect.objectContaining({ minWidth: 0 }));
    expect(screen.getByTestId('dashboard-side-column').props.style).toEqual(expect.objectContaining({ minWidth: 0 }));
    expect(screen.queryByText('Aprendiz')).toBeTruthy();
  });

  it.each([320, 390])('keeps long dashboard content readable at %dpx with enlarged font settings', async (width) => {
    const longDisplayName = 'Aventureiro com um nome deliberadamente longo para testar quebra de linha';
    const longTitle = 'Guardião das bibliotecas e do raciocínio paciente';
    const longSubject = 'Matemática aplicada, raciocínio lógico e resolução de problemas';
    mockUseWindowDimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale: 2 });
    mockedProfile.mockResolvedValue({ ...profile, displayName: longDisplayName, title: longTitle });
    mockedActivity.mockResolvedValue([{ ...session, subject: longSubject, durationValidSeconds: 45, discardedReason: 'too_short' }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByRole('header', { name: `Boas-vindas, ${longDisplayName}` })).toBeTruthy();
    expect(screen.getByText(longTitle)).toBeTruthy();
    expect(screen.getByText(longSubject)).toBeTruthy();
    expect(screen.getByText('45 s · 25 XP')).toBeTruthy();
    expect(screen.getByText('Sessão não contabilizada')).toBeTruthy();
    expect(screen.getByText(longSubject).props.allowFontScaling).toBe(true);
  });

  it('exposes each long activity item as one complete accessible announcement', async () => {
    const longSession = {
      ...session,
      subject: 'Matemática aplicada e raciocínio lógico avançado',
      discardedReason: 'too_short',
    };
    mockedProfile.mockResolvedValue({ ...profile, title: null });
    mockedActivity.mockResolvedValue([longSession]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.queryByText('Aprendiz')).toBeNull();
    expect(screen.getByLabelText(/Matemática aplicada e raciocínio lógico avançado.*foco.*25 min.*25 XP.*Sessão não contabilizada/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 4', value: { min: 100, max: 200, now: 150 } })).toBeTruthy();
  });

  it('keeps partial errors visible without putting the generic summary in the live region', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValue(new Error('activity offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-partial-error').props['aria-live']).toBe('off');
    expect(screen.getByTestId('dashboard-status').props['aria-live']).toBe('polite');
    expect(screen.getByTestId('dashboard-status').props['aria-atomic']).toBe(true);
  });

  it('uses named regions and preserves semantic card order on narrow screens', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([session]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText('Resumo de perfil')).toBeTruthy());
    expect(screen.getByLabelText('Progressão')).toBeTruthy();
    expect(screen.getByLabelText('Atividade recente')).toBeTruthy();
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'column' })]));
    expect(screen.getByTestId('dashboard-main-column').children.filter((child) => typeof child !== 'string').map((child) => 'props' in child ? child.props.testID : undefined)).toEqual([
      'dashboard-profile',
      'dashboard-progression',
      'dashboard-metrics',
      'dashboard-cadence',
    ]);
  });

  it('uses two columns on wide web screens while keeping activity in the side column', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 1200, height: 800, scale: 1, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([session]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'row' })]));
    expect(screen.getByTestId('dashboard-main-column').props.style).toEqual(expect.objectContaining({ flex: 2 }));
    expect(screen.getByTestId('dashboard-side-column').props.style).toEqual(expect.objectContaining({ flex: 1 }));
  });

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

  it('renders the streak metrics and 56-cell cadence card with accessible summaries', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-cadence')).toBeTruthy());
    expect(screen.getByText('4 dias')).toBeTruthy();
    expect(screen.getByText('2 / 4')).toBeTruthy();
    expect(screen.getByText(/60 min de foco válido/)).toBeTruthy();
    expect(screen.getByText(/Período: 24\/07 a 17\/09/)).toBeTruthy();
    expect(screen.getAllByTestId(/^dashboard-cadence-cell-/)).toHaveLength(56);
    expect(screen.getByTestId('dashboard-cadence-cell-0').props).toEqual(expect.objectContaining({ accessible: true, accessibilityRole: 'image', role: 'img', 'aria-label': expect.stringContaining('24/07') }));
    expect(screen.getByTestId('dashboard-cadence-cell-55').props['aria-label']).toContain('17/09');
  });

  it('keeps metrics loading and error states independent from profile and activity', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedMetrics.mockRejectedValue(new Error('metrics offline'));
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile')).toBeTruthy();
    expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy();
  });

  it('keeps cached metrics visible when a background refresh fails', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedMetrics.mockResolvedValueOnce(metrics);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics')).toBeTruthy());

    mockedMetrics.mockRejectedValueOnce(new Error('metrics offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics-refresh-error')).toBeTruthy());
    expect(screen.getByText('4 dias')).toBeTruthy();
    expect(screen.getByText('Métricas desatualizadas')).toBeTruthy();
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

  it('announces a cached profile refresh failure and keeps the previous profile visible', async () => {
    mockedProfile.mockResolvedValueOnce(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-profile')).toBeTruthy());

    mockedProfile.mockRejectedValueOnce(new Error('profile offline'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });
    await waitFor(() => expect(screen.getByTestId('dashboard-profile-refresh-error')).toBeTruthy());
    expect(screen.getByText('Boas-vindas, Aventureiro')).toBeTruthy();
    expect(screen.getByText('Progresso desatualizado')).toBeTruthy();
    expect(screen.getByTestId('dashboard-partial-error').props['aria-live']).toBe('off');
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
