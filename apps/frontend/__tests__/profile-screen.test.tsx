import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { theme } from '@/design-system';
import { getMyProfile, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import { listMyDeviceSessions, type DeviceSession } from '@/features/profile/api';
import { describeDevice, formatPlanTier } from '@/features/profile/formatters';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { updateMockAuthState } from '../test-utils/auth-context';
import { resetMockWindowDimensions, setMockWindowWidth } from '../test-utils/window-dimensions';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
  getSessionMetrics: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({ listMyDeviceSessions: jest.fn() }));

jest.mock('react-native', () => require('../test-utils/window-dimensions').createReactNativeMock());

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
};
const devices: DeviceSession[] = [
  { id: 'dev-1', deviceLabel: 'iPhone de Ana', userAgent: null, createdAt: '2026-09-01T10:00:00Z', lastUsedAt: '2026-09-20T10:00:00Z' },
  { id: 'dev-2', deviceLabel: null, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', createdAt: '2026-09-02T10:00:00Z', lastUsedAt: '2026-09-18T10:00:00Z' },
];

const metrics: SessionMetrics = {
  currentStreakDays: 3, longestStreakDays: 9, sessionsToday: 1, dailyGoal: 4, validSecondsToday: 900,
  cadence: { windowStart: '2026-09-11', windowEnd: '2026-10-08', days: [] },
};

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedDevices = listMyDeviceSessions as jest.MockedFunction<typeof listMyDeviceSessions>;
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;

async function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ProfileScreen /></QueryClientProvider>);
}

async function pullToRefresh() {
  await act(async () => {
    screen.getByTestId('profile-scroll').props.refreshControl.props.onRefresh();
  });
  await waitFor(() => expect(screen.getByTestId('profile-scroll').props.refreshControl.props.refreshing).toBe(false));
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  updateMockAuthState({ status: 'authenticated', sessionId: 'dev-1' });
  mockedProfile.mockResolvedValue(profile);
  mockedDevices.mockResolvedValue([]);
  mockedMetrics.mockResolvedValue(metrics);
  resetMockWindowDimensions();
  setMockWindowWidth(390);
});

afterEach(() => jest.clearAllMocks());

describe('ProfileScreen', () => {
  // react-query notifies observers on a timer; flush it inside act before RNTL unmounts the tree.
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('shows the character, level progression and the current device', async () => {
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    expect(screen.getByTestId('profile-character-title').props.children).toBe('Aprendiz');
    expect(screen.getByText('Nível 3')).toBeTruthy();
    expect(screen.getByText('Faltam 50 XP para o nível 4')).toBeTruthy();
    expect(screen.getByTestId('profile-plan').props.children).toBe('PLANO GRATUITO');

    await fireEvent.press(screen.getByTestId('profile-tab-dispositivos'));
    expect(await screen.findByTestId('profile-device-dev-1')).toBeTruthy();
    expect(screen.getByTestId('profile-device-current-dev-1')).toBeTruthy();
    expect(screen.queryByTestId('profile-device-current-dev-2')).toBeNull();
    expect(screen.getByText('Navegador no computador')).toBeTruthy();
  });

  it('keeps the level progression inside the character panel', async () => {
    await renderProfile();

    const panel = await screen.findByTestId('profile-character');
    expect(within(panel).getByText('Nível 3')).toBeTruthy();
    expect(within(panel).getByText('Faltam 50 XP para o nível 4')).toBeTruthy();
    expect(within(panel).getByTestId('profile-progress')).toBeTruthy();
    expect(screen.queryByTestId('profile-progression')).toBeNull();
  });

  it('shows the current streak and today sessions against the daily goal', async () => {
    await renderProfile();

    const streak = await screen.findByTestId('profile-stat-streak');
    expect(within(streak).getByText('Sequência atual')).toBeTruthy();
    expect(within(streak).getByText('3 dias')).toBeTruthy();
    const sessions = screen.getByTestId('profile-stat-sessions');
    expect(within(sessions).getByText('Sessões hoje')).toBeTruthy();
    expect(within(sessions).getByText('1 / 4')).toBeTruthy();
  });

  it('uses the singular form for a one-day streak', async () => {
    mockedMetrics.mockResolvedValue({ ...metrics, currentStreakDays: 1 });
    await renderProfile();

    const streak = await screen.findByTestId('profile-stat-streak');
    expect(within(streak).getByText('1 dia')).toBeTruthy();
  });

  it('shows only the sessions count when there is no daily goal', async () => {
    mockedMetrics.mockResolvedValue({ ...metrics, dailyGoal: 0 });
    await renderProfile();

    const sessions = await screen.findByTestId('profile-stat-sessions');
    expect(sessions.props.accessibilityLabel).toBe('Sessões hoje: 1');
    expect(within(sessions).getByText('1')).toBeTruthy();
  });

  it('announces each stat with its full value', async () => {
    await renderProfile();

    expect(await screen.findByLabelText('Sequência atual: 3 dias')).toBeTruthy();
    expect(screen.getByLabelText('Sessões hoje: 1 de 4')).toBeTruthy();
  });

  it('shows a loading note in the stats while the metrics load', async () => {
    mockedMetrics.mockReturnValue(new Promise(() => {}));
    await renderProfile();

    expect(await screen.findByTestId('profile-stats-loading')).toBeTruthy();
    expect(screen.getByText('Carregando estatísticas…')).toBeTruthy();
    expect(screen.getByText('Aventureiro')).toBeTruthy();
  });

  it('keeps the character visible and retries only the stats when the metrics fail', async () => {
    mockedMetrics.mockRejectedValueOnce(new Error('boom'));
    await renderProfile();

    const error = await screen.findByTestId('profile-stats-error');
    expect(within(error).getByText('Estatísticas indisponíveis.')).toBeTruthy();
    expect(screen.getByText('Aventureiro')).toBeTruthy();
    await fireEvent.press(within(error).getByLabelText('Tentar novamente'));
    expect(await screen.findByLabelText('Sequência atual: 3 dias')).toBeTruthy();
    expect(screen.queryByTestId('profile-stats-error')).toBeNull();
  });

  it('places the character panel beside the tabs on a wide web layout', async () => {
    setMockWindowWidth(1024);
    await renderProfile();

    const layout = await screen.findByTestId('profile-layout');
    expect(StyleSheet.flatten(layout.props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('profile-character').props.style).width).toBe(theme.layout.sidePanelWidth);
  });

  it('lists the three profile tabs in order and selects Cosméticos first', async () => {
    await renderProfile();

    const tablist = await screen.findByTestId('profile-tablist');
    expect(tablist.props.accessibilityRole).toBe('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Cosméticos', 'Companheiro', 'Dispositivos']);
    expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([true, false, false]);
  });

  it('switches the selected tab and the visible panel when a tab is pressed', async () => {
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('profile-tab-companheiro'));

    expect(screen.getByTestId('profile-tab-companheiro').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('profile-tab-cosmeticos').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('profile-tabpanel-companheiro')).toBeTruthy();
    expect(screen.queryByTestId('profile-tabpanel-cosmeticos')).toBeNull();
  });

  it('explains that cosmetics are coming soon in the first tab', async () => {
    await renderProfile();

    const soon = await screen.findByTestId('profile-cosmetics-soon');
    expect(within(soon).getByText('Cosméticos em breve')).toBeTruthy();
    expect(within(soon).getByText('Em breve você verá aqui o Catálogo e o Inventário do seu Character.')).toBeTruthy();
  });

  it('shows the companion as locked until phase two in the second tab', async () => {
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('profile-tab-companheiro'));

    const locked = await screen.findByTestId('profile-companion-locked');
    expect(within(locked).getByText('Companheiro chega na Fase 2')).toBeTruthy();
    expect(within(locked).getByText('Adiado por decisão do time (ADR-004): mascote com XP próprio, ganho a cada ciclo de foco.')).toBeTruthy();
  });

  it('gives each tab a touch target and underlines the selected tab in the accent color', async () => {
    await renderProfile();

    await screen.findByTestId('profile-tablist');
    for (const id of ['cosmeticos', 'companheiro', 'dispositivos']) {
      const tab = StyleSheet.flatten(screen.getByTestId(`profile-tab-${id}`).props.style);
      expect(tab.minHeight).toBeGreaterThanOrEqual(theme.layout.touchTarget);
      expect(tab.minWidth).toBeGreaterThanOrEqual(theme.layout.touchTarget);
    }
    const selected = StyleSheet.flatten(screen.getByTestId('profile-tab-cosmeticos').props.style);
    const idle = StyleSheet.flatten(screen.getByTestId('profile-tab-companheiro').props.style);
    expect(selected.borderBottomWidth).toBeGreaterThan(0);
    expect(selected.borderBottomColor).toBe(theme.color.accentPrimary);
    expect(idle.borderBottomColor).not.toBe(theme.color.accentPrimary);
  });

  it('stacks the character panel above the tabs on a narrow layout', async () => {
    setMockWindowWidth(390);
    await renderProfile();

    const layout = await screen.findByTestId('profile-layout');
    expect(StyleSheet.flatten(layout.props.style).flexDirection).not.toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('profile-character').props.style).width).not.toBe(theme.layout.sidePanelWidth);
  });

  it('falls back to a placeholder title when the character has none', async () => {
    mockedProfile.mockResolvedValue({ ...profile, title: null });
    await renderProfile();

    expect(await screen.findByText('Sem título ainda')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profile-tab-dispositivos'));
    expect(await screen.findByText('Nenhum dispositivo com sessão ativa.')).toBeTruthy();
  });

  it('shows a retryable error when the profile cannot be loaded', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('boom'));
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByTestId('profile-error')).toBeTruthy();
    mockedProfile.mockResolvedValue(profile);
    await fireEvent.press(screen.getByLabelText('Tentar novamente'));
    expect(await screen.findByText('Aventureiro')).toBeTruthy();
  });

  it('lists the connected devices only inside the devices tab', async () => {
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByTestId('profile-tablist')).toBeTruthy();
    expect(screen.queryByTestId('profile-devices')).toBeNull();

    await fireEvent.press(screen.getByTestId('profile-tab-dispositivos'));

    const list = await screen.findByTestId('profile-devices');
    expect(within(list).getByText('Dispositivos conectados')).toBeTruthy();
    expect(await screen.findByTestId('profile-device-dev-1')).toBeTruthy();
  });

  it('refetches the character, devices and stats when the user pulls to refresh', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await pullToRefresh();

    expect(mockedMetrics).toHaveBeenCalledTimes(2);
    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedDevices).toHaveBeenCalledTimes(2);
  });

  it('keeps the character with a stale-data notice when the pull to refresh fails', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockedProfile.mockResolvedValueOnce(profile).mockRejectedValueOnce(new Error('boom'));
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await pullToRefresh();

    expect(screen.getByTestId('profile-refresh-error')).toBeTruthy();
    expect(screen.getByText('Dados desatualizados')).toBeTruthy();
    expect(screen.getByText('Aventureiro')).toBeTruthy();
  });

  it('shows the character loading state before the profile arrives', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    mockedProfile.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      await renderProfile();
    });

    expect(await screen.findByTestId('profile-loading')).toBeTruthy();
    expect(screen.getByText('Carregando seu personagem…')).toBeTruthy();
    expect(screen.queryByTestId('profile-tablist')).toBeNull();
  });

  it('shows a loading note in the devices tab while the devices load', async () => {
    mockedDevices.mockReturnValue(new Promise(() => {}));
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profile-tab-dispositivos'));
    expect(await screen.findByTestId('profile-devices-loading')).toBeTruthy();
    expect(screen.getByText('Carregando seus dispositivos…')).toBeTruthy();
  });

  it('keeps the character visible when only the device list fails', async () => {
    mockedDevices.mockRejectedValue(new Error('boom'));
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profile-tab-dispositivos'));
    await waitFor(() => expect(screen.getByTestId('profile-devices-error')).toBeTruthy());
    expect(screen.getByTestId('profile-character')).toBeTruthy();
    expect(screen.getByText('Aventureiro')).toBeTruthy();
  });
});

describe('profile formatters', () => {
  it('describes plans and devices', () => {
    expect(formatPlanTier('premium')).toBe('Plano premium');
    expect(formatPlanTier('free')).toBe('Plano gratuito');
    expect(describeDevice({ deviceLabel: ' Pixel ', userAgent: null })).toBe('Pixel');
    expect(describeDevice({ deviceLabel: null, userAgent: 'Dalvik Android 14' })).toBe('Dispositivo Android');
    expect(describeDevice({ deviceLabel: null, userAgent: null })).toBe('Dispositivo desconhecido');
  });
});
