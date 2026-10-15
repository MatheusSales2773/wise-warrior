import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { theme } from '@/design-system';
import { CharacterScreen } from '@/features/character/character-screen';
import { getMyProfile, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import {
  equipCosmeticItem,
  listCosmeticsCatalog,
  listMyDeviceSessions,
  revokeAllMyDeviceSessions,
  revokeMyDeviceSession,
  unequipCosmeticItem,
  type CatalogCosmeticItem,
  type DeviceSession,
} from '@/features/profile/api';
import { mockAuthState, updateMockAuthState } from '../test-utils/auth-context';
import { resetMockWindowDimensions, setMockWindowDimensions } from '../test-utils/window-dimensions';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());
jest.mock('react-native', () => require('../test-utils/window-dimensions').createReactNativeMock());
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

/** The seeded Catalog as the level-14 Character of the Figma frame sees it. */
const catalog: CatalogCosmeticItem[] = [
  cosmetic('Capuz do Erudito', 'avatar', { type: 'level', level: 1 }, { equipped: true }),
  cosmetic('Manto da Vigília', 'avatar', { type: 'level', level: 8 }, { unlocked: true }),
  cosmetic('Madrugador', 'badge', { type: 'level', level: 3 }, { unlocked: true }),
  cosmetic('Cem Sessões', 'badge', { type: 'level', level: 12 }, { unlocked: true }),
  cosmetic('Aprendiz', 'title', { type: 'level', level: 1 }, { unlocked: true }),
  cosmetic('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { equipped: true }),
  cosmetic('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true }),
  cosmetic('Selo dos Madrugadores', 'accessory', { type: 'raid', slug: '*' }),
];

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Membro da Ordem dos Madrugadores', planTier: 'free',
  level: 14, levelStartXp: 126_450, nextLevelXp: 129_450, xpTotal: 128_400, title: 'Estudante Crepuscular',
  equipped: [
    { category: 'avatar', itemId: 'item-Capuz do Erudito', name: 'Capuz do Erudito' },
    { category: 'title', itemId: 'item-Estudante Crepuscular', name: 'Estudante Crepuscular' },
  ],
};
const metrics: SessionMetrics = {
  currentStreakDays: 27, longestStreakDays: 30, sessionsToday: 2, dailyGoal: 4, validSecondsToday: 3_000,
  cadence: { windowStart: '2026-08-01', windowEnd: '2026-09-25', days: [] },
};
const devices: DeviceSession[] = [
  { id: 'dev-1', deviceLabel: 'iPhone de Ana', userAgent: null, createdAt: '2026-09-01T10:00:00Z', lastUsedAt: '2026-09-20T10:00:00Z' },
  { id: 'dev-2', deviceLabel: null, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', createdAt: '2026-09-02T10:00:00Z', lastUsedAt: '2026-09-18T10:00:00Z' },
  { id: 'dev-3', deviceLabel: 'Notebook', userAgent: null, createdAt: '2026-09-03T10:00:00Z', lastUsedAt: '2026-09-19T10:00:00Z' },
];

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;
const mockedCatalog = listCosmeticsCatalog as jest.MockedFunction<typeof listCosmeticsCatalog>;
const mockedDevices = listMyDeviceSessions as jest.MockedFunction<typeof listMyDeviceSessions>;
const mockedEquip = equipCosmeticItem as jest.MockedFunction<typeof equipCosmeticItem>;
const mockedUnequip = unequipCosmeticItem as jest.MockedFunction<typeof unequipCosmeticItem>;
const mockedRevoke = revokeMyDeviceSession as jest.MockedFunction<typeof revokeMyDeviceSession>;
const mockedRevokeAll = revokeAllMyDeviceSessions as jest.MockedFunction<typeof revokeAllMyDeviceSessions>;

// A mutation keeps a 5-minute GC timer by default, which would hold the Jest process open after the run.
let queryClient: QueryClient | undefined;

async function renderCharacter(overrides: Partial<UserProfile> = {}) {
  mockedProfile.mockResolvedValue({ ...profile, ...overrides });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  queryClient = client;
  await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('character-hero-panel')).toBeTruthy());
}

function useWidth(width: number) {
  setMockWindowDimensions({ width, height: width < 900 ? 844 : 1024 });
}

function color(node: { props: Record<string, unknown> }) {
  return StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.color;
}

const identity = () => within(screen.getByTestId('character-identity'));

async function openTitles() {
  await fireEvent.press(screen.getByTestId('character-slot-title'));
  await screen.findByRole('radio', { name: /^Estudante Crepuscular,/ });
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  updateMockAuthState({ status: 'authenticated', sessionId: 'dev-1' });
  resetMockWindowDimensions();
  useWidth(1440);
  mockedMetrics.mockResolvedValue(metrics);
  mockedCatalog.mockResolvedValue(catalog);
  mockedDevices.mockResolvedValue(devices);
  mockedEquip.mockResolvedValue(undefined);
  mockedUnequip.mockResolvedValue(undefined);
  mockedRevoke.mockResolvedValue(undefined);
  mockedRevokeAll.mockResolvedValue(undefined);
});

afterEach(async () => {
  // react-query notifies observers on a timer; flush it inside act before RNTL unmounts the tree.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  queryClient?.clear();
  queryClient = undefined;
  jest.clearAllMocks();
});

describe('CharacterScreen', () => {
  it('shows a busy state while the profile loads', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient = client;
    await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);

    expect(screen.getByRole('header', { name: 'Personagem' })).toBeTruthy();
    expect(screen.getByText('Carregando seu personagem…')).toBeTruthy();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient = client;
    await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByTestId('character-error')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('character-hero-panel')).toBeTruthy());
  });

  describe('desktop layout (Figma v2)', () => {
    it('lays out the fixed hero panel beside the scrolling content', async () => {
      await renderCharacter();

      expect(screen.getByTestId('character-desktop')).toBeTruthy();
      expect(StyleSheet.flatten(screen.getByTestId('character-hero-panel').props.style)).toMatchObject({ borderRightWidth: 1, paddingHorizontal: 40 });
      expect(StyleSheet.flatten(screen.getByTestId('character-content').props.style)).toMatchObject({ padding: 48, gap: 36 });
    });

    it('presents identity, level progress and the summary stats from the API', async () => {
      await renderCharacter();

      expect(screen.getByRole('header', { name: 'Personagem' })).toBeTruthy();
      expect(identity().getByText('✦ Nível 14 · Erudito')).toBeTruthy();
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
      expect(identity().getByText('Membro da Ordem dos Madrugadores')).toBeTruthy();
      expect(identity().getByText('1.950 / 3.000 XP')).toBeTruthy();
      expect(identity().getByText('Nível 15 em 1.050 XP')).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 15' }).props.accessibilityValue).toEqual({ min: 0, max: 3_000, now: 1_950 });

      await waitFor(() => expect(screen.getByLabelText('27 dias seguidos')).toBeTruthy());
      expect(screen.getByLabelText('2/4 sessões hoje')).toBeTruthy();
      expect(screen.getByLabelText('128,4k XP total')).toBeTruthy();
    });

    it('shows the name and e-mail when no Título is equipped', async () => {
      await renderCharacter({ title: null, equipped: profile.equipped.filter((item) => item.category !== 'title') });

      expect(identity().getByText('Membro da Ordem dos Madrugadores')).toBeTruthy();
      expect(identity().getByText('wise@example.com')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Título: vazio. Equipar título' })).toBeTruthy();
    });

    it('fills the slots from what the profile has equipped and invites the user to fill the rest', async () => {
      await renderCharacter();

      expect(screen.getByRole('button', { name: 'Avatar: Capuz do Erudito' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Título: Estudante Crepuscular' })).toBeTruthy();
      expect(screen.getByTestId('character-slot-title-equipped')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Badge: vazio. Equipar badge' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Acessório: vazio. Equipar acessório' })).toBeTruthy();
      expect(StyleSheet.flatten(screen.getByTestId('character-slot-accessory').props.style)).toMatchObject({ borderStyle: 'dashed', borderColor: theme.color.borderEmphasis });
      expect(color(screen.getByText('Equipar acessório'))).toBe(theme.color.accentPrimary);
    });

    it('derives the hero roster from level and plan', async () => {
      await renderCharacter();

      expect(screen.getByText('2 de 4 desbloqueados')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-erudito')).getByText('EQUIPADO')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Equipar Guerreira' })).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-arcanista')).getByText('Libera no nível 20')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-arcanista')).getByText('NÍVEL 20')).toBeTruthy();
      expect(color(within(screen.getByTestId('character-hero-arcanista')).getByText('Arcanista'))).toBe(theme.color.textTertiary);
      expect(within(screen.getByTestId('character-hero-paladino')).getByText('✦ PREMIUM')).toBeTruthy();
    });

    it('keeps level-gated heroes locked below their level and opens premium heroes for premium plans', async () => {
      await renderCharacter({ level: 9, planTier: 'premium' });

      expect(screen.getByText('2 de 4 desbloqueados')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-guerreira')).getByText('NÍVEL 10')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Equipar Paladino' })).toBeTruthy();
    });

    it('explains that hero swapping is not available yet instead of pretending to switch', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByRole('button', { name: 'Trocar herói' }));
      expect(within(screen.getByTestId('character-notice')).getByText(/A troca de herói chega em breve/)).toBeTruthy();
    });

    it('summarizes the connected devices', async () => {
      await renderCharacter();

      await waitFor(() => expect(screen.getByText('Este navegador e mais 2 sessões')).toBeTruthy());
      expect(screen.getByText('Coruja de estudo · chega na Fase 2')).toBeTruthy();
    });

    it('opens the equipment drawer on the tapped category with the real Catalog', async () => {
      await renderCharacter();
      await openTitles();

      const drawer = within(screen.getByTestId('equipment-drawer'));
      expect(drawer.getByRole('header', { name: 'Escolher título' })).toBeTruthy();
      expect(drawer.getByText('Aparece abaixo do seu nome em todo o app')).toBeTruthy();
      expect(drawer.getByRole('tab', { name: 'Título' }).props.accessibilityState).toMatchObject({ selected: true });
      expect(drawer.getByRole('radio', { name: 'Estudante Crepuscular, Equipado agora' }).props.accessibilityState).toMatchObject({ checked: true });
      expect(drawer.getByRole('radio', { name: 'Aprendiz, Título inicial' }).props.accessibilityState).toMatchObject({ checked: false });
      expect(drawer.getByRole('radio', { name: 'Mestre da Aurora, Plano premium, exclusivo do plano premium' })).toBeDisabled();
      expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
      expect(drawer.getByRole('button', { name: 'Equipar título' })).toBeTruthy();
    });

    it('closes with Cancelar and the backdrop', async () => {
      await renderCharacter();

      await openTitles();
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();

      await openTitles();
      await fireEvent.press(screen.getByTestId('equipment-modal-backdrop', { includeHiddenElements: true }));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
    });

    it('switches categories from the segmented control', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByRole('button', { name: 'Gerenciar equipamento' }));
      expect(await screen.findByRole('header', { name: 'Escolher avatar' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Manto da Vigília, Liberado no nível 8' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('tab', { name: 'Acessório' }));
      expect(screen.getByRole('header', { name: 'Escolher acessório' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Selo dos Madrugadores, Conclua uma Raid com sua Guilda, bloqueado' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Equipar acessório' })).toBeDisabled();
    });

    it('tells how far the next item is in a category without anything unlocked', async () => {
      mockedCatalog.mockResolvedValue([
        ...catalog.filter((item) => item.category !== 'badge'),
        cosmetic('Madrugador', 'badge', { type: 'level', level: 3 }),
        cosmetic('Cem Sessões', 'badge', { type: 'level', level: 12 }),
      ]);
      await renderCharacter({ level: 1 });

      await fireEvent.press(screen.getByTestId('character-slot-badge'));
      expect(await screen.findByText('Faltam 2 níveis para desbloquear Madrugador.')).toBeTruthy();
    });

    it('shows a retryable error when the Catalog cannot be loaded', async () => {
      mockedCatalog.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(catalog);
      await renderCharacter();

      await fireEvent.press(screen.getByTestId('character-slot-title'));
      const error = await screen.findByTestId('equipment-error');
      await fireEvent.press(within(error).getByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByRole('radio', { name: /^Aprendiz,/ })).toBeTruthy();
    });
  });

  describe('Prévia, Equipar and Desequipar', () => {
    it('previews the selection on the hero panel without saving anything', async () => {
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));

      expect(identity().getByText('Aprendiz')).toBeTruthy();
      expect(screen.getByTestId('character-preview')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Título: Aprendiz' })).toBeTruthy();
      expect(mockedEquip).not.toHaveBeenCalled();
    });

    it('drops the Prévia when the drawer closes or the category changes', async () => {
      await renderCharacter();
      await openTitles();
      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));

      await fireEvent.press(screen.getByRole('tab', { name: 'Badge' }));
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
      expect(screen.queryByTestId('character-preview')).toBeNull();

      await fireEvent.press(screen.getByRole('tab', { name: 'Título' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
      expect(mockedEquip).not.toHaveBeenCalled();
    });

    it('equips the selection, shows it at once and reloads the Catalog and the profile', async () => {
      let finishEquip: () => void = () => undefined;
      mockedEquip.mockImplementation(() => new Promise<void>((resolve) => { finishEquip = resolve; }));
      await renderCharacter();
      await openTitles();
      expect(mockedCatalog).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

      await waitFor(() => expect(mockedEquip).toHaveBeenCalledWith('item-Aprendiz'));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
      expect(identity().getByText('Aprendiz')).toBeTruthy();
      expect(screen.queryByTestId('character-preview')).toBeNull();
      await act(async () => { finishEquip(); });
      await waitFor(() => expect(mockedCatalog).toHaveBeenCalledTimes(2));
      expect(mockedProfile).toHaveBeenCalledTimes(2);
    });

    it('closes without a request when the equipped item is kept', async () => {
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
      expect(mockedEquip).not.toHaveBeenCalled();
    });

    it('unequips the equipped item of the category', async () => {
      mockedUnequip.mockImplementation(async () => {
        // The server's answer after the change, which the reload picks up.
        mockedProfile.mockResolvedValue({ ...profile, title: null, equipped: profile.equipped.filter((item) => item.category !== 'title') });
        mockedCatalog.mockResolvedValue(catalog.map((item) => (item.name === 'Estudante Crepuscular' ? { ...item, equipped: false } : item)));
      });
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('button', { name: 'Desequipar Estudante Crepuscular' }));

      await waitFor(() => expect(mockedUnequip).toHaveBeenCalledWith('item-Estudante Crepuscular'));
      expect(screen.getByRole('button', { name: 'Título: vazio. Equipar título' })).toBeTruthy();
      await waitFor(() => expect(mockedProfile).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('button', { name: 'Título: vazio. Equipar título' })).toBeTruthy();
    });

    it('rolls the optimistic change back and explains when the server refuses', async () => {
      mockedEquip.mockRejectedValue(new ApiError('server', { status: 500 }));
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

      const notice = await screen.findByTestId('character-status-equipment');
      expect(within(notice).getByText('Nada foi equipado')).toBeTruthy();
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
    });

    it('rolls an unequip back when the server refuses', async () => {
      mockedUnequip.mockRejectedValue(new ApiError('network'));
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('button', { name: 'Desequipar Estudante Crepuscular' }));

      const notice = await screen.findByTestId('character-status-equipment');
      expect(within(notice).getByText('Nada foi desequipado')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Título: Estudante Crepuscular' })).toBeTruthy();
    });

    it('lets a premium plan pick a premium item and gives a premium refusal its own message', async () => {
      mockedEquip.mockRejectedValue(new ApiError('unexpected', { status: 403 }));
      mockedCatalog.mockResolvedValue(catalog.map((item) => (item.name === 'Mestre da Aurora' ? { ...item, unlocked: true } : item)));
      await renderCharacter({ level: 15, planTier: 'premium' });
      await openTitles();

      await fireEvent.press(screen.getByRole('radio', { name: 'Mestre da Aurora, Liberado no nível 15' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

      const notice = await screen.findByTestId('character-status-equipment');
      expect(within(notice).getByText('Item exclusivo do plano premium')).toBeTruthy();
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
    });

    it('keeps locked items out of reach', async () => {
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('radio', { name: /^Mestre da Aurora,/ }));

      expect(screen.queryByTestId('character-preview')).toBeNull();
      expect(screen.getByRole('radio', { name: 'Estudante Crepuscular, Equipado agora' }).props.accessibilityState).toMatchObject({ checked: true });
    });
  });

  describe('mobile layout (Figma v2)', () => {
    beforeEach(() => useWidth(390));

    it('uses the single scrolling column with the 352px hero stage on top', async () => {
      await renderCharacter();

      expect(screen.getByTestId('character-scroll')).toBeTruthy();
      expect(screen.queryByTestId('character-desktop')).toBeNull();
      expect(StyleSheet.flatten(screen.getByTestId('character-hero-panel').props.style)).toMatchObject({ height: 352 });
      expect(screen.getByTestId('character-hero-sprite', { includeHiddenElements: true }).props).toMatchObject({ width: 144, height: 216 });
    });

    it('shows level and title with progress, without the desktop name subtitle', async () => {
      await renderCharacter();

      expect(identity().getByText('✦ Nível 14 · Erudito')).toBeTruthy();
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
      expect(identity().getByText('1.950 / 3.000 XP')).toBeTruthy();
      expect(screen.queryByText('Membro da Ordem dos Madrugadores')).toBeNull();
      await waitFor(() => expect(screen.getByLabelText('27 dias seguidos')).toBeTruthy());
    });

    it('draws compact slots that show only the category label', async () => {
      await renderCharacter();

      expect(screen.getByRole('button', { name: 'Título: Estudante Crepuscular' })).toBeTruthy();
      expect(within(screen.getByTestId('character-slot-title')).getByText('TÍTULO')).toBeTruthy();
      expect(within(screen.getByTestId('character-slot-title')).queryByText('Estudante Crepuscular')).toBeNull();
      expect(screen.getByText('Gerenciar')).toBeTruthy();
    });

    it('scrolls the hero cards horizontally and counts what is unlocked', async () => {
      await renderCharacter();

      expect(screen.getByTestId('character-hero-carousel').props.horizontal).toBe(true);
      expect(screen.getByLabelText('2 de 4 heróis desbloqueados')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Arcanista, Libera no nível 20' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar Guerreira' }));
      expect(within(screen.getByTestId('character-notice')).getByText(/A troca de herói chega em breve/)).toBeTruthy();
    });

    it('words the device row for mobile and counts the sessions', async () => {
      await renderCharacter();

      expect(screen.getByText('Coruja de estudo · em breve')).toBeTruthy();
      await waitFor(() => expect(screen.getByText('Este navegador e mais 2')).toBeTruthy());
      expect(within(screen.getByTestId('character-devices')).getByText('3')).toBeTruthy();
    });

    it('opens a bottom sheet that keeps or equips the Título', async () => {
      await renderCharacter();
      await openTitles();

      const sheet = within(screen.getByTestId('equipment-drawer'));
      expect(StyleSheet.flatten(screen.getByTestId('equipment-drawer').props.style)).toMatchObject({ borderTopLeftRadius: 16, paddingHorizontal: 24 });
      expect(sheet.getByRole('button', { name: 'Manter este título' })).toBeTruthy();
      expect(sheet.queryByRole('button', { name: 'Cancelar' })).toBeNull();

      await fireEvent.press(sheet.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
      await fireEvent.press(sheet.getByRole('button', { name: 'Equipar título' }));
      await waitFor(() => expect(mockedEquip).toHaveBeenCalledWith('item-Aprendiz'));
    });

    it('closes the sheet from its handle', async () => {
      await renderCharacter();
      await openTitles();

      await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
    });

    it('treats a native phone as mobile even when the window is wide and refreshes everything on pull', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      useWidth(1440);
      await renderCharacter();
      expect(mockedCatalog).toHaveBeenCalledTimes(1);

      await act(async () => {
        screen.getByTestId('character-scroll').props.refreshControl.props.onRefresh();
      });
      await waitFor(() => expect(screen.getByTestId('character-scroll').props.refreshControl.props.refreshing).toBe(false));

      expect(mockedProfile).toHaveBeenCalledTimes(2);
      expect(mockedCatalog).toHaveBeenCalledTimes(2);
      expect(mockedDevices).toHaveBeenCalledTimes(2);
      expect(mockedMetrics).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Este dispositivo e mais 2')).toBeTruthy();
    });

    it('keeps the character with a stale-data notice when a refresh fails', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      await renderCharacter();
      mockedProfile.mockRejectedValue(new ApiError('network'));

      await act(async () => {
        screen.getByTestId('character-scroll').props.refreshControl.props.onRefresh();
      });

      expect(await screen.findByTestId('character-status-profile')).toBeTruthy();
      expect(identity().getByText('Estudante Crepuscular')).toBeTruthy();
    });
  });

  describe('ending devices', () => {
    const otherDevice = 'Navegador no computador';

    async function openDevices() {
      await renderCharacter();
      await fireEvent.press(await screen.findByRole('button', { name: /^Dispositivos conectados\./ }));
      await screen.findByTestId('profile-device-dev-2');
    }

    it('opens from the Dispositivos conectados row and closes again', async () => {
      await openDevices();

      expect(screen.getByTestId('devices-panel')).toBeTruthy();
      expect(screen.getByTestId('profile-device-current-dev-1')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByTestId('devices-panel')).toBeNull();
    });

    it('offers an Encerrar button on every device except the current one', async () => {
      await openDevices();

      expect(screen.getByRole('button', { name: `Encerrar ${otherDevice}` })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Encerrar iPhone de Ana' })).toBeNull();
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
