import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { theme } from '@/design-system';
import { CharacterScreen } from '@/features/character/character-screen';
import { getMyDeviceSessions, type DeviceSession } from '@/features/character/api';
import { getMyProfile, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';

const mockUseWindowDimensions = jest.fn(() => ({ width: 1440, height: 1024, scale: 1, fontScale: 1 }));

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

jest.mock('@/features/character/api', () => ({ getMyDeviceSessions: jest.fn() }));

// Mirrors the Figma "Personagem — Desktop v2 · Visão geral" frame.
const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Membro da Ordem dos Madrugadores', planTier: 'free',
  level: 14, levelStartXp: 126_450, nextLevelXp: 129_450, xpTotal: 128_400, title: 'Estudante Crepuscular',
};
const metrics: SessionMetrics = {
  currentStreakDays: 27, longestStreakDays: 30, sessionsToday: 2, dailyGoal: 4, validSecondsToday: 3_000,
  cadence: { windowStart: '2026-08-01', windowEnd: '2026-09-25', days: [] },
};
const device = (id: string): DeviceSession => ({ id, deviceLabel: null, userAgent: null, createdAt: '2026-09-01T00:00:00Z', lastUsedAt: '2026-09-01T00:00:00Z' });

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;
const mockedDevices = getMyDeviceSessions as jest.MockedFunction<typeof getMyDeviceSessions>;

async function renderCharacter(overrides: Partial<UserProfile> = {}) {
  mockedProfile.mockResolvedValue({ ...profile, ...overrides });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('character-hero-panel')).toBeTruthy());
}

function color(node: { props: Record<string, unknown> }) {
  return StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.color;
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  mockedMetrics.mockResolvedValue(metrics);
  mockedDevices.mockResolvedValue([device('d1'), device('d2'), device('d3')]);
});

afterEach(() => {
  jest.clearAllMocks();
  mockUseWindowDimensions.mockReturnValue({ width: 1440, height: 1024, scale: 1, fontScale: 1 });
});

describe('CharacterScreen', () => {
  it('shows a busy state while the profile loads', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);

    expect(screen.getByRole('header', { name: 'Personagem' })).toBeTruthy();
    expect(screen.getByText('Carregando seu personagem…')).toBeTruthy();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    await render(<QueryClientProvider client={client}><CharacterScreen /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByTestId('character-error')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('character-hero-panel')).toBeTruthy());
  });

  it('lays out the fixed hero panel beside the scrolling content on desktop web', async () => {
    await renderCharacter();

    expect(screen.getByTestId('character-desktop')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('character-hero-panel').props.style)).toMatchObject({ borderRightWidth: 1, paddingHorizontal: 40 });
    expect(StyleSheet.flatten(screen.getByTestId('character-content').props.style)).toMatchObject({ padding: 48, gap: 36 });
  });

  it('stacks the panel above the content below the desktop breakpoint', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    await renderCharacter();

    expect(screen.queryByTestId('character-desktop')).toBeNull();
    expect(screen.getByTestId('character-scroll')).toBeTruthy();
  });

  it('presents identity, level progress and the summary stats from the API', async () => {
    await renderCharacter();

    expect(screen.getByRole('header', { name: 'Personagem' })).toBeTruthy();
    const identity = within(screen.getByTestId('character-identity'));
    expect(identity.getByText('✦ Nível 14 · Erudito')).toBeTruthy();
    expect(identity.getByText('Estudante Crepuscular')).toBeTruthy();
    expect(identity.getByText('Membro da Ordem dos Madrugadores')).toBeTruthy();
    expect(identity.getByText('1.950 / 3.000 XP')).toBeTruthy();
    expect(identity.getByText('Nível 15 em 1.050 XP')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 15' }).props.accessibilityValue).toEqual({ min: 0, max: 3_000, now: 1_950 });

    await waitFor(() => expect(screen.getByLabelText('27 dias seguidos')).toBeTruthy());
    expect(screen.getByLabelText('2/4 sessões hoje')).toBeTruthy();
    expect(screen.getByLabelText('128,4k XP total')).toBeTruthy();
  });

  it('falls back to the initial title when the profile has none', async () => {
    await renderCharacter({ title: null });

    expect(within(screen.getByTestId('character-identity')).getByText('Aprendiz')).toBeTruthy();
    expect(within(screen.getByTestId('character-slot-title')).getByText('Aprendiz')).toBeTruthy();
  });

  it('marks equipped slots and invites the user to fill empty ones', async () => {
    await renderCharacter();

    expect(screen.getByRole('button', { name: 'Avatar: Capuz do Erudito' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Título: Estudante Crepuscular' })).toBeTruthy();
    expect(screen.getByTestId('character-slot-title-equipped')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acessório: vazio. Equipar acessório' })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('character-slot-accessory').props.style)).toMatchObject({ borderStyle: 'dashed', borderColor: theme.color.borderEmphasis });
    expect(color(screen.getByText('Equipar acessório'))).toBe(theme.color.accentPrimary);
  });

  it('derives the hero roster from level and plan', async () => {
    await renderCharacter();

    expect(screen.getByText('2 de 4 desbloqueados')).toBeTruthy();
    expect(within(screen.getByTestId('character-hero-erudito')).getByText('EQUIPADO')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Equipar Guerreira' })).toBeTruthy();
    expect(within(screen.getByTestId('character-hero-guerreira')).getByText('Liberada no nível 10')).toBeTruthy();
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
    expect(within(screen.getByTestId('character-identity')).getByText('✦ Nível 14 · Erudito')).toBeTruthy();
  });

  it('summarizes the connected devices', async () => {
    await renderCharacter();

    await waitFor(() => expect(screen.getByText('Este navegador e mais 2 sessões')).toBeTruthy());
    expect(screen.getByText('Coruja de estudo · chega na Fase 2')).toBeTruthy();
  });

  describe('equipment drawer', () => {
    it('opens on the tapped category with the equipped title selected', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByTestId('character-slot-title'));
      const drawer = within(screen.getByTestId('equipment-drawer'));
      expect(drawer.getByRole('header', { name: 'Escolher título' })).toBeTruthy();
      expect(drawer.getByText('Aparece abaixo do seu nome em todo o app')).toBeTruthy();
      expect(drawer.getByRole('tab', { name: 'Título' }).props.accessibilityState).toMatchObject({ selected: true });
      expect(drawer.getByRole('radio', { name: 'Estudante Crepuscular, Equipado agora' }).props.accessibilityState).toMatchObject({ checked: true });
      expect(drawer.getByRole('radio', { name: 'Aprendiz, Título inicial' }).props.accessibilityState).toMatchObject({ checked: false });
      expect(drawer.getByRole('radio', { name: 'Mestre da Aurora, Plano premium, exclusivo do plano premium' })).toBeDisabled();
      expect(drawer.getByRole('radio', { name: 'Guardião da Aurora, Recompensa da raid semanal, bloqueado' })).toBeDisabled();
    });

    it('does not claim to equip a different title while the inventory API is missing', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByTestId('character-slot-title'));
      await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
      expect(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }).props.accessibilityState).toMatchObject({ checked: true });
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

      expect(within(screen.getByTestId('equipment-unavailable')).getByText(/Estudante Crepuscular continua equipado/)).toBeTruthy();
      expect(screen.getByTestId('equipment-drawer')).toBeTruthy();
      expect(within(screen.getByTestId('character-slot-title')).getByText('Estudante Crepuscular')).toBeTruthy();
    });

    it('closes when confirming the item that is already equipped', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByTestId('character-slot-title'));
      await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
    });

    it('switches categories from the segmented control and closes with Cancelar', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByRole('button', { name: 'Gerenciar equipamento' }));
      expect(screen.getByRole('header', { name: 'Escolher avatar' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('tab', { name: 'Acessório' }));
      expect(screen.getByRole('header', { name: 'Escolher acessório' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Equipar acessório' })).toBeDisabled();

      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByTestId('equipment-drawer')).toBeNull();
    });
  });

  describe('mobile layout (Figma v2)', () => {
    beforeEach(() => {
      mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    });

    it('uses the single scrolling column with the 352px hero stage on top', async () => {
      await renderCharacter();

      expect(screen.getByTestId('character-scroll')).toBeTruthy();
      expect(screen.queryByTestId('character-desktop')).toBeNull();
      expect(StyleSheet.flatten(screen.getByTestId('character-hero-panel').props.style)).toMatchObject({ height: 352 });
      expect(screen.getByRole('header', { name: 'Personagem' })).toBeTruthy();
      expect(screen.getByTestId('character-hero-sprite', { includeHiddenElements: true }).props).toMatchObject({ width: 144, height: 216 });
    });

    it('shows level and title with progress, without the desktop name subtitle', async () => {
      await renderCharacter();

      const identity = within(screen.getByTestId('character-identity'));
      expect(identity.getByText('✦ Nível 14 · Erudito')).toBeTruthy();
      expect(identity.getByText('Estudante Crepuscular')).toBeTruthy();
      expect(identity.getByText('1.950 / 3.000 XP')).toBeTruthy();
      expect(identity.getByText('Nível 15 em 1.050 XP')).toBeTruthy();
      expect(screen.queryByText('Membro da Ordem dos Madrugadores')).toBeNull();
      expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 15' }).props.accessibilityValue).toEqual({ min: 0, max: 3_000, now: 1_950 });
      await waitFor(() => expect(screen.getByLabelText('27 dias seguidos')).toBeTruthy());
      expect(screen.getByLabelText('2/4 sessões hoje')).toBeTruthy();
      expect(screen.getByLabelText('128,4k XP total')).toBeTruthy();
    });

    it('draws compact slots that show only the category label', async () => {
      await renderCharacter();

      expect(screen.getByRole('button', { name: 'Título: Estudante Crepuscular' })).toBeTruthy();
      expect(within(screen.getByTestId('character-slot-title')).getByText('TÍTULO')).toBeTruthy();
      expect(within(screen.getByTestId('character-slot-title')).queryByText('Estudante Crepuscular')).toBeNull();
      expect(screen.getByTestId('character-slot-title-equipped')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Badge: vazio. Equipar badge' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Gerenciar equipamento' })).toBeTruthy();
      expect(screen.getByText('Gerenciar')).toBeTruthy();
    });

    it('scrolls the hero cards horizontally and counts what is unlocked', async () => {
      await renderCharacter();

      expect(screen.getByTestId('character-hero-carousel').props.horizontal).toBe(true);
      expect(screen.getByLabelText('2 de 4 heróis desbloqueados')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-erudito')).getByText('EQUIPADO')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-guerreira')).getByText('EQUIPAR')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-arcanista')).getByText('NÍVEL 20')).toBeTruthy();
      expect(within(screen.getByTestId('character-hero-paladino')).getByText('✦ PREMIUM')).toBeTruthy();
      expect(color(within(screen.getByTestId('character-hero-arcanista')).getByText('Arcanista'))).toBe(theme.color.textTertiary);
      expect(screen.getByRole('group', { name: 'Arcanista, Libera no nível 20' })).toBeTruthy();
    });

    it('makes the whole unlocked hero card the target and explains that equipping is not available yet', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByRole('button', { name: 'Equipar Guerreira' }));
      expect(within(screen.getByTestId('character-notice')).getByText(/A troca de herói chega em breve/)).toBeTruthy();
    });

    it('swaps heroes from the icon button in the stage header', async () => {
      await renderCharacter();

      await fireEvent.press(screen.getByRole('button', { name: 'Trocar herói' }));
      expect(within(screen.getByTestId('character-notice')).getByText(/A troca de herói chega em breve/)).toBeTruthy();
    });

    it('words the companion and device rows for mobile and counts the sessions', async () => {
      await renderCharacter();

      expect(screen.getByText('Coruja de estudo · em breve')).toBeTruthy();
      await waitFor(() => expect(screen.getByText('Este navegador e mais 2')).toBeTruthy());
      expect(within(screen.getByTestId('character-devices')).getByText('3')).toBeTruthy();
    });

    it('treats a native phone as mobile even when the window is wide', async () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'ios' });
      mockUseWindowDimensions.mockReturnValue({ width: 1440, height: 1024, scale: 1, fontScale: 1 });
      await renderCharacter();

      expect(screen.getByTestId('character-scroll')).toBeTruthy();
      await waitFor(() => expect(screen.getByText('Este dispositivo e mais 2')).toBeTruthy());
    });

    describe('bottom sheet', () => {
      it('rises from the bottom with the equipped title selected and a keep action', async () => {
        await renderCharacter();

        await fireEvent.press(screen.getByTestId('character-slot-title'));
        const sheet = within(screen.getByTestId('equipment-drawer'));
        expect(sheet.getByRole('header', { name: 'Escolher título' })).toBeTruthy();
        expect(sheet.getByRole('tab', { name: 'Título' }).props.accessibilityState).toMatchObject({ selected: true });
        expect(sheet.getByRole('radio', { name: 'Estudante Crepuscular, Equipado agora' }).props.accessibilityState).toMatchObject({ checked: true });
        expect(sheet.getByRole('radio', { name: 'Mestre da Aurora, Plano premium, exclusivo do plano premium' })).toBeDisabled();
        expect(sheet.getByRole('radio', { name: 'Guardião da Aurora, Recompensa da raid semanal, bloqueado' })).toBeDisabled();
        expect(sheet.getByRole('button', { name: 'Manter este título' })).toBeTruthy();
        expect(sheet.queryByRole('button', { name: 'Cancelar' })).toBeNull();
        expect(StyleSheet.flatten(screen.getByTestId('equipment-drawer').props.style)).toMatchObject({ borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 24 });
      });

      it('closes from the handle, the keep action and the backdrop', async () => {
        await renderCharacter();

        await fireEvent.press(screen.getByTestId('character-slot-title'));
        await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
        expect(screen.queryByTestId('equipment-drawer')).toBeNull();

        await fireEvent.press(screen.getByTestId('character-slot-title'));
        await fireEvent.press(screen.getByRole('button', { name: 'Manter este título' }));
        expect(screen.queryByTestId('equipment-drawer')).toBeNull();

        await fireEvent.press(screen.getByTestId('character-slot-title'));
        await fireEvent.press(screen.getByTestId('equipment-backdrop', { includeHiddenElements: true }));
        expect(screen.queryByTestId('equipment-drawer')).toBeNull();
      });

      it('offers to equip a different title but does not claim it was saved', async () => {
        await renderCharacter();

        await fireEvent.press(screen.getByTestId('character-slot-title'));
        await fireEvent.press(screen.getByRole('radio', { name: 'Aprendiz, Título inicial' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Equipar título' }));

        expect(within(screen.getByTestId('equipment-unavailable')).getByText(/Estudante Crepuscular continua equipado/)).toBeTruthy();
        expect(screen.getByTestId('equipment-drawer')).toBeTruthy();
        expect(within(screen.getByTestId('character-slot-title')).getByText('TÍTULO')).toBeTruthy();
      });

      it('switches category and blocks the action while an empty slot has nothing selected', async () => {
        await renderCharacter();

        await fireEvent.press(screen.getByRole('button', { name: 'Gerenciar equipamento' }));
        expect(screen.getByRole('header', { name: 'Escolher avatar' })).toBeTruthy();
        await fireEvent.press(screen.getByRole('tab', { name: 'Acessório' }));
        expect(screen.getByRole('header', { name: 'Escolher acessório' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Equipar acessório' })).toBeDisabled();
      });
    });
  });
});
