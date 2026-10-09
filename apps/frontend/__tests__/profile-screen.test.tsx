import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { theme } from '@/design-system';
import { getMyProfile, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import { ApiError } from '@/core/api/api-error';
import {
  equipCosmeticItem,
  listCosmeticsCatalog,
  unequipCosmeticItem,
  listMyDeviceSessions,
  revokeAllMyDeviceSessions,
  revokeMyDeviceSession,
  type CatalogCosmeticItem,
  type DeviceSession,
} from '@/features/profile/api';
import { cosmeticItemState, describeDevice, describeNextUnlock, formatPlanTier } from '@/features/profile/formatters';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { mockAuthState, updateMockAuthState } from '../test-utils/auth-context';
import { resetMockWindowDimensions, setMockWindowWidth } from '../test-utils/window-dimensions';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
  getSessionMetrics: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({
  equipCosmeticItem: jest.fn(),
  unequipCosmeticItem: jest.fn(),
  listCosmeticsCatalog: jest.fn(),
  listMyDeviceSessions: jest.fn(),
  revokeMyDeviceSession: jest.fn(),
  revokeAllMyDeviceSessions: jest.fn(),
}));

jest.mock('react-native', () => require('../test-utils/window-dimensions').createReactNativeMock());

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
  equipped: [
    { category: 'avatar', itemId: 'item-Capuz do Erudito', name: 'Capuz do Erudito' },
    { category: 'title', itemId: 'item-Aprendiz', name: 'Aprendiz' },
  ],
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
const mockedCatalog = listCosmeticsCatalog as jest.MockedFunction<typeof listCosmeticsCatalog>;

function cosmetic(
  name: string,
  category: CatalogCosmeticItem['category'],
  unlockCondition: CatalogCosmeticItem['unlockCondition'],
  state: { unlocked?: boolean; equipped?: boolean; requiresPremium?: boolean } = {},
): CatalogCosmeticItem {
  return {
    id: `item-${name}`, category, name, unlockCondition,
    requiresPremium: state.requiresPremium ?? false,
    unlocked: state.unlocked ?? state.equipped ?? false,
    equipped: state.equipped ?? false,
  };
}

/** The seeded Catalog as a new level-1 Character sees it. */
const starterCatalog: CatalogCosmeticItem[] = [
  cosmetic('Capuz do Erudito', 'avatar', { type: 'level', level: 1 }, { equipped: true }),
  cosmetic('Manto da Vigília', 'avatar', { type: 'level', level: 8 }),
  cosmetic('Madrugador', 'badge', { type: 'level', level: 3 }),
  cosmetic('Cem Sessões', 'badge', { type: 'level', level: 12 }),
  cosmetic('Aprendiz', 'title', { type: 'level', level: 1 }, { equipped: true }),
  cosmetic('Estudante Crepuscular', 'title', { type: 'level', level: 5 }),
  cosmetic('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true }),
  cosmetic('Selo dos Madrugadores', 'accessory', { type: 'raid', slug: '*' }),
];

function cosmeticNames(categoryTestId: string) {
  return within(screen.getByTestId(categoryTestId)).getAllByTestId(/^profile-cosmetic-item-/)
    .map((item) => item.props.testID.replace('profile-cosmetic-item-item-', ''));
}
const mockedEquip = equipCosmeticItem as jest.MockedFunction<typeof equipCosmeticItem>;
const mockedUnequip = unequipCosmeticItem as jest.MockedFunction<typeof unequipCosmeticItem>;
const mockedRevoke = revokeMyDeviceSession as jest.MockedFunction<typeof revokeMyDeviceSession>;
const mockedRevokeAll = revokeAllMyDeviceSessions as jest.MockedFunction<typeof revokeAllMyDeviceSessions>;

// A mutation keeps a 5-minute GC timer by default, which would hold the Jest process open after the run.
let queryClient: QueryClient | undefined;

async function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  queryClient = client;
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
  mockedCatalog.mockResolvedValue(starterCatalog);
  mockedEquip.mockResolvedValue(undefined);
  mockedUnequip.mockResolvedValue(undefined);
  mockedRevoke.mockResolvedValue(undefined);
  mockedRevokeAll.mockResolvedValue(undefined);
  resetMockWindowDimensions();
  setMockWindowWidth(390);
});

afterEach(() => {
  queryClient?.clear();
  queryClient = undefined;
  jest.clearAllMocks();
});

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
    expect(screen.getByLabelText('Título: Aprendiz')).toBeTruthy();
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

  it('shows the whole Catalog grouped by category in the first tab', async () => {
    await renderProfile();

    const catalog = await screen.findByTestId('profile-cosmetics');
    const headers = within(catalog).getAllByRole('header').map((header) => header.props.children);
    expect(headers).toEqual(['Avatares', 'Badges', 'Títulos', 'Acessórios']);
    expect(cosmeticNames('profile-cosmetics-avatar')).toEqual(['Capuz do Erudito', 'Manto da Vigília']);
    expect(cosmeticNames('profile-cosmetics-accessory')).toEqual(['Selo dos Madrugadores']);
  });

  it('tells equipped, unlocked, locked and premium items apart in text, not only in color', async () => {
    mockedCatalog.mockResolvedValue([
      ...starterCatalog.filter((item) => item.category !== 'title'),
      cosmetic('Aprendiz', 'title', { type: 'level', level: 1 }, { equipped: true }),
      cosmetic('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { unlocked: true }),
      cosmetic('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true }),
    ]);
    await renderProfile();

    const equipped = await screen.findByTestId('profile-cosmetic-item-item-Aprendiz');
    expect(equipped.props.accessibilityLabel).toBe('Aprendiz, equipado');
    expect(within(equipped).getByText('EQUIPADO')).toBeTruthy();

    const unlocked = screen.getByTestId('profile-cosmetic-item-item-Estudante Crepuscular');
    expect(unlocked.props.accessibilityLabel).toBe('Estudante Crepuscular, desbloqueado');
    expect(within(unlocked).getByText('DESBLOQUEADO')).toBeTruthy();

    const premium = screen.getByTestId('profile-cosmetic-item-item-Mestre da Aurora');
    expect(premium.props.accessibilityLabel).toBe('Mestre da Aurora, item premium, bloqueado. Alcance o nível 15');
    expect(within(premium).getByText('✦')).toBeTruthy();
    expect(within(premium).getByTestId('profile-cosmetic-lock')).toBeTruthy();
    expect(within(premium).getByText('Alcance o nível 15')).toBeTruthy();

    const raid = screen.getByTestId('profile-cosmetic-item-item-Selo dos Madrugadores');
    expect(raid.props.accessibilityLabel).toBe('Selo dos Madrugadores, bloqueado. Conclua uma Raid com sua Guilda');
    expect(within(raid).getByTestId('profile-cosmetic-lock')).toBeTruthy();
  });

  it('orders each category as equipped, unlocked, locked by level and Raid items last', async () => {
    mockedCatalog.mockResolvedValue([
      cosmetic('Lenda da Guilda', 'title', { type: 'raid', slug: 'dragao-do-pantano' }),
      cosmetic('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true }),
      cosmetic('Aprendiz', 'title', { type: 'level', level: 1 }, { unlocked: true }),
      cosmetic('Sábio', 'title', { type: 'level', level: 10 }),
      cosmetic('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { equipped: true }),
    ]);
    await renderProfile();

    await screen.findByTestId('profile-cosmetics-title');
    expect(cosmeticNames('profile-cosmetics-title')).toEqual([
      'Estudante Crepuscular', 'Aprendiz', 'Sábio', 'Mestre da Aurora', 'Lenda da Guilda',
    ]);
    expect(screen.getByText('Conclua a Raid dragao-do-pantano')).toBeTruthy();
  });

  it('shows the progress to the next item in a category without unlocked items', async () => {
    mockedProfile.mockResolvedValue({ ...profile, level: 1 });
    await renderProfile();

    const badges = await screen.findByTestId('profile-cosmetics-badge');
    expect(within(badges).getByTestId('profile-cosmetics-next').props.children).toBe('Faltam 2 níveis para desbloquear Madrugador.');
    const accessories = screen.getByTestId('profile-cosmetics-accessory');
    expect(within(accessories).getByTestId('profile-cosmetics-next').props.children).toBe('Os itens desta categoria são conquistados em Raids com sua Guilda.');
    expect(within(screen.getByTestId('profile-cosmetics-avatar')).queryByTestId('profile-cosmetics-next')).toBeNull();
  });

  it('uses the singular when the next item is one level away', async () => {
    mockedProfile.mockResolvedValue({ ...profile, level: 2 });
    await renderProfile();

    const badges = await screen.findByTestId('profile-cosmetics-badge');
    expect(within(badges).getByTestId('profile-cosmetics-next').props.children).toBe('Falta 1 nível para desbloquear Madrugador.');
  });

  it('shows a loading note while the Catalog loads', async () => {
    mockedCatalog.mockReturnValue(new Promise(() => {}));
    await renderProfile();

    expect(await screen.findByTestId('profile-cosmetics-loading')).toBeTruthy();
    expect(screen.getByText('Carregando o Catálogo…')).toBeTruthy();
    expect(screen.getByText('Aventureiro')).toBeTruthy();
  });

  it('shows a retryable error when the Catalog cannot be loaded', async () => {
    mockedCatalog.mockRejectedValueOnce(new Error('boom'));
    await renderProfile();

    const error = await screen.findByTestId('profile-cosmetics-error');
    expect(within(error).getByText('Não foi possível carregar o Catálogo.')).toBeTruthy();
    await fireEvent.press(within(error).getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('profile-cosmetics')).toBeTruthy();
    expect(screen.queryByTestId('profile-cosmetics-error')).toBeNull();
  });

  it('keeps the Catalog with a stale-data notice when its refresh fails', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockedCatalog.mockResolvedValueOnce(starterCatalog).mockRejectedValueOnce(new Error('boom'));
    await renderProfile();

    expect(await screen.findByTestId('profile-cosmetics')).toBeTruthy();
    await pullToRefresh();

    expect(screen.getByTestId('profile-cosmetics-stale')).toBeTruthy();
    expect(screen.getByTestId('profile-cosmetic-item-item-Capuz do Erudito')).toBeTruthy();
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

  it('shows the full equipment: Título banner, Badge and Acessório seals and the Avatar over the silhouette', async () => {
    mockedProfile.mockResolvedValue({
      ...profile,
      title: 'Estudante Crepuscular',
      equipped: [
        { category: 'avatar', itemId: 'item-Manto da Vigília', name: 'Manto da Vigília' },
        { category: 'badge', itemId: 'item-Madrugador', name: 'Madrugador' },
        { category: 'title', itemId: 'item-Estudante Crepuscular', name: 'Estudante Crepuscular' },
        { category: 'accessory', itemId: 'item-Selo dos Madrugadores', name: 'Selo dos Madrugadores' },
      ],
    });
    await renderProfile();

    const panel = await screen.findByTestId('profile-character');
    expect(within(panel).getByLabelText('Título: Estudante Crepuscular')).toBeTruthy();
    expect(within(panel).getByLabelText('Badge: Madrugador')).toBeTruthy();
    expect(within(panel).getByLabelText('Acessório: Selo dos Madrugadores')).toBeTruthy();
    expect(within(panel).getByLabelText('Avatar: Manto da Vigília').props.accessibilityRole).toBe('image');
    expect(within(panel).getByTestId('profile-avatar')).toBeTruthy();
  });

  it('shows only what is equipped when the equipment is partial', async () => {
    mockedProfile.mockResolvedValue({
      ...profile,
      equipped: [...profile.equipped, { category: 'badge', itemId: 'item-Madrugador', name: 'Madrugador' }],
    });
    await renderProfile();

    const panel = await screen.findByTestId('profile-character');
    expect(within(panel).getByLabelText('Avatar: Capuz do Erudito')).toBeTruthy();
    expect(within(panel).getByLabelText('Título: Aprendiz')).toBeTruthy();
    expect(within(panel).getByLabelText('Badge: Madrugador')).toBeTruthy();
    expect(within(panel).queryByTestId('profile-seal-accessory')).toBeNull();
  });

  it('shows the default silhouette and no Título when nothing is equipped', async () => {
    mockedProfile.mockResolvedValue({ ...profile, title: null, equipped: [] });
    await renderProfile();

    const panel = await screen.findByTestId('profile-character');
    expect(within(panel).getByLabelText('Avatar: silhueta padrão')).toBeTruthy();
    expect(within(panel).queryByTestId('profile-avatar')).toBeNull();
    expect(within(panel).queryByTestId('profile-title-banner')).toBeNull();
    expect(within(panel).queryByTestId('profile-seal-badge')).toBeNull();
    expect(within(panel).queryByTestId('profile-seal-accessory')).toBeNull();
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

  it('refetches the character, Catalog, devices and stats when the user pulls to refresh', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockedDevices.mockResolvedValue(devices);
    await renderProfile();

    expect(await screen.findByText('Aventureiro')).toBeTruthy();
    await pullToRefresh();

    expect(mockedMetrics).toHaveBeenCalledTimes(2);
    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedDevices).toHaveBeenCalledTimes(2);
    expect(mockedCatalog).toHaveBeenCalledTimes(2);
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

  describe('ending devices', () => {
    const otherDevice = 'Navegador no computador';

    async function openDevices() {
      mockedDevices.mockResolvedValue(devices);
      await renderProfile();
      await fireEvent.press(await screen.findByTestId('profile-tab-dispositivos'));
      await screen.findByTestId('profile-device-dev-2');
    }

    it('offers an Encerrar button on every device except the current one', async () => {
      await openDevices();

      expect(screen.getByRole('button', { name: `Encerrar ${otherDevice}` })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Encerrar iPhone de Ana' })).toBeNull();
      expect(within(screen.getByTestId('profile-device-dev-1')).queryByText('Encerrar')).toBeNull();
    });

    it('asks for confirmation and keeps the device when the student declines', async () => {
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: `Encerrar ${otherDevice}` }));
      expect(screen.getByText(`Encerrar o acesso de ${otherDevice}?`)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: `Manter ${otherDevice} conectado` }));

      expect(screen.queryByText(`Encerrar o acesso de ${otherDevice}?`)).toBeNull();
      expect(mockedRevoke).not.toHaveBeenCalled();
    });

    it('ends another device after confirmation and reloads the list without disconnecting', async () => {
      await openDevices();
      expect(mockedDevices).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByRole('button', { name: `Encerrar ${otherDevice}` }));
      await fireEvent.press(screen.getByRole('button', { name: `Confirmar: encerrar ${otherDevice}` }));

      await waitFor(() => expect(mockedRevoke).toHaveBeenCalledWith('dev-2'));
      await waitFor(() => expect(mockedDevices).toHaveBeenCalledTimes(2));
      expect(mockAuthState.logout).not.toHaveBeenCalled();
    });

    it('explains a device that was already ended, reloads the list and keeps the student connected', async () => {
      mockedRevoke.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: `Encerrar ${otherDevice}` }));
      await fireEvent.press(screen.getByRole('button', { name: `Confirmar: encerrar ${otherDevice}` }));

      const notice = await screen.findByTestId('profile-devices-notice');
      expect(within(notice).getByText(`${otherDevice} já tinha sido desconectado em outro lugar. A lista foi atualizada.`)).toBeTruthy();
      await waitFor(() => expect(mockedDevices).toHaveBeenCalledTimes(2));
      expect(mockAuthState.logout).not.toHaveBeenCalled();
    });

    it('keeps the device and explains a failure that is not a missing device', async () => {
      mockedRevoke.mockRejectedValue(new ApiError('network'));
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: `Encerrar ${otherDevice}` }));
      await fireEvent.press(screen.getByRole('button', { name: `Confirmar: encerrar ${otherDevice}` }));

      const notice = await screen.findByTestId('profile-devices-notice');
      expect(within(notice).getByText('Não foi possível encerrar o dispositivo. Verifique sua conexão e tente novamente.')).toBeTruthy();
      expect(mockAuthState.logout).not.toHaveBeenCalled();
    });

    it('signs out of every device after confirmation and disconnects the student', async () => {
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: 'Sair de todos os dispositivos' }));
      expect(mockedRevokeAll).not.toHaveBeenCalled();
      expect(screen.getByText(/inclusive este/)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Confirmar: sair de todos os dispositivos' }));

      await waitFor(() => expect(mockedRevokeAll).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockAuthState.logout).toHaveBeenCalledTimes(1));
    });

    it('explains and reloads when leaving this device fails after every session was ended', async () => {
      mockAuthState.logout.mockRejectedValueOnce(new ApiError('network'));
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: 'Sair de todos os dispositivos' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Confirmar: sair de todos os dispositivos' }));

      const notice = await screen.findByTestId('profile-devices-notice');
      expect(within(notice).getByText('Todos os dispositivos foram desconectados, mas este ainda não concluiu a saída. Verifique sua conexão e tente de novo.')).toBeTruthy();
      expect(screen.queryByText(/inclusive este/)).toBeNull();
      await waitFor(() => expect(mockedDevices).toHaveBeenCalledTimes(2));
    });

    it('cancels signing out of every device', async () => {
      await openDevices();

      await fireEvent.press(screen.getByRole('button', { name: 'Sair de todos os dispositivos' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar saída de todos os dispositivos' }));

      expect(screen.queryByText(/inclusive este/)).toBeNull();
      expect(mockedRevokeAll).not.toHaveBeenCalled();
    });
  });
});

describe('Prévia, Equipar and unequip', () => {
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  const unlockedCatalog: CatalogCosmeticItem[] = [
    ...starterCatalog.filter((item) => item.category !== 'title'),
    cosmetic('Aprendiz', 'title', { type: 'level', level: 1 }, { equipped: true }),
    cosmetic('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { unlocked: true }),
    cosmetic('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { unlocked: true, requiresPremium: true }),
  ];
  const titleBanner = () => within(screen.getByTestId('profile-character')).queryByTestId('profile-title-banner');

  async function openPreview(name: string) {
    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${name},`) }));
  }

  beforeEach(() => {
    mockedCatalog.mockResolvedValue(unlockedCatalog);
    mockedProfile.mockResolvedValue({ ...profile, level: 15 });
  });

  it('applies the Prévia to the character panel without saving anything', async () => {
    await renderProfile();

    await openPreview('Estudante Crepuscular');

    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Estudante Crepuscular');
    expect(screen.getByTestId('profile-preview-badge')).toBeTruthy();
    expect(within(screen.getByTestId('profile-cosmetics-preview')).getByText('Prévia: Estudante Crepuscular')).toBeTruthy();
    expect(mockedEquip).not.toHaveBeenCalled();
  });

  it('discards the Prévia on Cancelar and restores the character', async () => {
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar a prévia de Estudante Crepuscular' }));

    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Aprendiz');
    expect(screen.queryByTestId('profile-cosmetics-preview')).toBeNull();
    expect(screen.queryByTestId('profile-preview-badge')).toBeNull();
    expect(mockedEquip).not.toHaveBeenCalled();
  });

  it('previews one item at a time', async () => {
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    await openPreview('Mestre da Aurora');

    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Mestre da Aurora');
    expect(screen.getAllByTestId('profile-cosmetics-preview')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Mestre da Aurora,/ }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: /^Estudante Crepuscular,/ }).props.accessibilityState.selected).toBe(false);
  });

  it('drops the Prévia when the student leaves the Cosméticos tab', async () => {
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    await fireEvent.press(screen.getByTestId('profile-tab-companheiro'));

    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Aprendiz');
  });

  it('opens no Prévia for a locked item and offers no way to equip it', async () => {
    await renderProfile();
    const locked = await screen.findByTestId('profile-cosmetic-item-item-Manto da Vigília');

    await fireEvent.press(locked);

    expect(screen.queryByRole('button', { name: /^Manto da Vigília,/ })).toBeNull();
    expect(screen.queryByTestId('profile-cosmetics-preview')).toBeNull();
    expect(mockedEquip).not.toHaveBeenCalled();
  });

  it('equips on Equipar, shows it at once and reloads the Catalog and the profile', async () => {
    let finishEquip: () => void = () => undefined;
    mockedEquip.mockImplementation(() => new Promise<void>((resolve) => { finishEquip = resolve; }));
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    await fireEvent.press(screen.getByRole('button', { name: 'Equipar Estudante Crepuscular' }));

    await waitFor(() => expect(mockedEquip).toHaveBeenCalledWith('item-Estudante Crepuscular'));
    expect(screen.queryByTestId('profile-cosmetics-preview')).toBeNull();
    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Estudante Crepuscular');
    expect(screen.getByRole('button', { name: 'Estudante Crepuscular, equipado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aprendiz, desbloqueado' })).toBeTruthy();
    await act(async () => { finishEquip(); });
  });

  it('invalidates the Catalog and the profile once Equipar finishes', async () => {
    await renderProfile();
    await screen.findByTestId('profile-cosmetics');
    expect(mockedCatalog).toHaveBeenCalledTimes(1);
    expect(mockedProfile).toHaveBeenCalledTimes(1);
    await openPreview('Estudante Crepuscular');

    await fireEvent.press(screen.getByRole('button', { name: 'Equipar Estudante Crepuscular' }));

    await waitFor(() => expect(mockedCatalog).toHaveBeenCalledTimes(2));
    expect(mockedProfile).toHaveBeenCalledTimes(2);
  });

  it('unequips an equipped item of any category, including the Título', async () => {
    mockedUnequip.mockImplementation(async () => {
      // The server's answer after the change, which the reload picks up.
      mockedProfile.mockResolvedValue({ ...profile, level: 15, title: null, equipped: profile.equipped.filter((item) => item.category !== 'title') });
      mockedCatalog.mockResolvedValue(unlockedCatalog.map((item) => (item.name === 'Aprendiz' ? { ...item, equipped: false } : item)));
    });
    await renderProfile();
    await openPreview('Aprendiz');
    expect(screen.queryByRole('button', { name: 'Equipar Aprendiz' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Desequipar Aprendiz' }));

    await waitFor(() => expect(mockedUnequip).toHaveBeenCalledWith('item-Aprendiz'));
    expect(titleBanner()).toBeNull();
    expect(screen.getByRole('button', { name: 'Aprendiz, desbloqueado' })).toBeTruthy();
    await waitFor(() => expect(mockedProfile).toHaveBeenCalledTimes(2));
  });

  it('rolls the optimistic change back and explains when the server refuses', async () => {
    mockedEquip.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    await fireEvent.press(screen.getByRole('button', { name: 'Equipar Estudante Crepuscular' }));

    const notice = await screen.findByTestId('profile-cosmetics-notice');
    expect(within(notice).getByText('Nada foi equipado')).toBeTruthy();
    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Aprendiz');
    expect(screen.getByRole('button', { name: 'Aprendiz, equipado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estudante Crepuscular, desbloqueado' })).toBeTruthy();
  });

  it('rolls an unequip back when the server refuses', async () => {
    mockedUnequip.mockRejectedValue(new ApiError('network'));
    await renderProfile();
    await openPreview('Aprendiz');

    await fireEvent.press(screen.getByRole('button', { name: 'Desequipar Aprendiz' }));

    const notice = await screen.findByTestId('profile-cosmetics-notice');
    expect(within(notice).getByText('Nada foi desequipado')).toBeTruthy();
    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Aprendiz');
  });

  it('gives a premium refusal its own message', async () => {
    mockedEquip.mockRejectedValue(new ApiError('unexpected', { status: 403 }));
    await renderProfile();
    await openPreview('Mestre da Aurora');

    await fireEvent.press(screen.getByRole('button', { name: 'Equipar Mestre da Aurora' }));

    const notice = await screen.findByTestId('profile-cosmetics-notice');
    expect(within(notice).getByText('Item exclusivo do plano premium')).toBeTruthy();
    expect(within(notice).getByText(/Mestre da Aurora é exclusivo do plano premium/)).toBeTruthy();
    expect(titleBanner()?.props.accessibilityLabel).toBe('Título: Aprendiz');
  });

  it('labels the controls for assistive technology', async () => {
    await renderProfile();
    await openPreview('Estudante Crepuscular');

    const item = screen.getByRole('button', { name: 'Estudante Crepuscular, desbloqueado' });
    expect(item.props.accessibilityState.selected).toBe(true);
    const equip = screen.getByRole('button', { name: 'Equipar Estudante Crepuscular' });
    const cancel = screen.getByRole('button', { name: 'Cancelar a prévia de Estudante Crepuscular' });
    expect(equip.props.accessibilityRole).toBe('button');
    expect(cancel.props.accessibilityRole).toBe('button');
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

describe('cosmetics formatters', () => {
  it('reads one display state per Catalog item', () => {
    expect(cosmeticItemState(cosmetic('A', 'title', { type: 'level', level: 1 }, { equipped: true }))).toBe('equipped');
    expect(cosmeticItemState(cosmetic('B', 'title', { type: 'level', level: 1 }, { unlocked: true }))).toBe('unlocked');
    expect(cosmeticItemState(cosmetic('C', 'title', { type: 'level', level: 5 }))).toBe('lockedByLevel');
    expect(cosmeticItemState(cosmetic('D', 'title', { type: 'raid', slug: '*' }))).toBe('lockedByRaid');
  });

  it('does not send the student to Raids when a level item is already within reach but not yet granted', () => {
    const items = [
      cosmetic('Madrugador', 'badge', { type: 'level', level: 3 }),
      cosmetic('Selo', 'badge', { type: 'raid', slug: '*' }),
    ];

    expect(describeNextUnlock(items, 4)).toBe('Madrugador já está liberado para o seu nível.');
    expect(describeNextUnlock(items, 1)).toBe('Faltam 2 níveis para desbloquear Madrugador.');
  });
});
