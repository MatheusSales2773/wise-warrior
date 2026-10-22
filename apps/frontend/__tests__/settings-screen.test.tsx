import { act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router as appRouter, Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Platform, Text } from 'react-native';
import { AppShell } from '@/design-system/components/AppShell';
import { getMyProfile, type UserProfile } from '@/features/dashboard/api';
import { resetViewport, setViewport } from '../test-utils/viewport';
import { mockAuthState, updateMockAuthState } from '../test-utils/auth-context';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());
jest.mock('@/core/realtime/realtime-runtime', () => ({ RealtimeRuntime: () => null }));
// jest-expo leaves the Expo config empty; the app reads the version from app.json.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: require('../app.json').expo } }));
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(() => new Promise(() => undefined)),
  getSessionMetrics: jest.fn(() => new Promise(() => undefined)),
}));

const profile: UserProfile = {
  id: 'user-1', email: 'knightshade@wise.app', displayName: 'Knightshade', planTier: 'free',
  level: 3, levelStartXp: 0, nextLevelXp: 1_000, xpTotal: 400, title: null, equipped: [],
};

const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const settingsRoutes = {
  'configuracao/_layout': require('../src/app/(app)/configuracao/_layout'),
  'configuracao/index': require('../src/app/(app)/configuracao/index'),
  'configuracao/conta': require('../src/app/(app)/configuracao/conta'),
  'configuracao/foco': require('../src/app/(app)/configuracao/foco'),
  'configuracao/dispositivos': require('../src/app/(app)/configuracao/dispositivos'),
  'configuracao/acessibilidade': require('../src/app/(app)/configuracao/acessibilidade'),
  'configuracao/plano': require('../src/app/(app)/configuracao/plano'),
};

/**
 * The web renders the real Configuração routes under the app shell. The root Stack measures the DOM on web,
 * which the test renderer lacks, so the web cases mount the shell over a Slot, as the app layout does.
 */
async function openSettings(initialUrl: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = Platform.OS === 'web'
    ? renderRouter({
      _layout: () => <QueryClientProvider client={client}><AppShell><Slot /></AppShell></QueryClientProvider>,
      ...settingsRoutes,
      entrar: () => <Text>Entrar</Text>,
    }, { initialUrl })
    : renderRouter('src/app', { initialUrl });
  await router;
  await screen.findByTestId('settings');
  // Wrapped: an async function would unwrap the thenable router into its render result.
  return { router };
}

beforeEach(() => {
  mockedProfile.mockResolvedValue(profile);
});

afterEach(async () => {
  updateMockAuthState({ status: 'authenticated' });
  mockAuthState.logout.mockReset();
  mockAuthState.logout.mockResolvedValue(undefined);
  await resetViewport();
});

describe('Configuração on desktop', () => {
  beforeEach(async () => {
    await setViewport('web', 1440);
  });

  it('opens on Conta e segurança with the inner section menu and the account header', async () => {
    await openSettings('/configuracao');

    expect(screen.getByRole('link', { name: 'Configuração' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('header', { name: 'Configuração' })).toBeTruthy();
    const menu = within(screen.getByLabelText('Seções da configuração'));
    for (const section of ['Conta e segurança', 'Foco', 'Dispositivos', 'Acessibilidade', 'Plano']) {
      expect(menu.getByRole('link', { name: section })).toBeTruthy();
    }
    expect(menu.getByRole('link', { name: 'Conta e segurança' }).props.accessibilityState.selected).toBe(true);
    expect(menu.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();

    expect(screen.getByRole('header', { name: 'Conta e segurança' })).toBeTruthy();
    expect(await screen.findByText('knightshade@wise.app')).toBeTruthy();
    expect(screen.getByText('Knightshade')).toBeTruthy();
    expect(screen.getByText('PLANO FREE')).toBeTruthy();
    expect(screen.getByText('Wise Warrior · versão 0.1.0')).toBeTruthy();
  });

  it('points each item of the inner menu at its own address', async () => {
    await openSettings('/configuracao/plano');

    const menu = within(screen.getByLabelText('Seções da configuração'));
    expect(menu.getByRole('link', { name: 'Conta e segurança' }).props.href).toBe('/configuracao');
    expect(menu.getByRole('link', { name: 'Foco' }).props.href).toBe('/configuracao/foco');
    expect(menu.getByRole('link', { name: 'Dispositivos' }).props.href).toBe('/configuracao/dispositivos');
    expect(menu.getByRole('link', { name: 'Acessibilidade' }).props.href).toBe('/configuracao/acessibilidade');
    expect(menu.getByRole('link', { name: 'Plano' }).props.href).toBe('/configuracao/plano');
    expect(menu.getByRole('link', { name: 'Plano' }).props.accessibilityState.selected).toBe(true);
    expect(menu.getByRole('link', { name: 'Conta e segurança' }).props.accessibilityState.selected).toBe(false);
    expect(await menu.findByText('FREE')).toBeTruthy();
  });

  it('shows the current plan in Plano without any upgrade action', async () => {
    await openSettings('/configuracao/plano');

    expect(screen.getByRole('header', { name: 'Plano' })).toBeTruthy();
    expect(await screen.findByText('Free · premium em breve')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /premium|upgrade|assinar/i })).toBeNull();
  });

  it('offers a retry in Plano when the account cannot be loaded', async () => {
    mockedProfile.mockRejectedValue(new Error('offline'));
    await openSettings('/configuracao/plano');

    expect(await screen.findByText('Não foi possível carregar sua conta.')).toBeTruthy();
    mockedProfile.mockResolvedValue(profile);
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Free · premium em breve')).toBeTruthy();
  });

  it.each([
    ['/configuracao/conta', 'Conta e segurança'],
    ['/configuracao/foco', 'Foco'],
    ['/configuracao/dispositivos', 'Dispositivos'],
    ['/configuracao/acessibilidade', 'Acessibilidade'],
    ['/configuracao/plano', 'Plano'],
  ])('opens %s directly with its section selected', async (url, section) => {
    await openSettings(url);

    expect(screen.getByRole('link', { name: section }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Seções da configuração')).toBeTruthy();
  });

  it('hides the items that are out of scope', async () => {
    await openSettings('/configuracao');

    for (const hidden of ['Notificações', 'Meta diária', 'Tema', 'Alterar senha', 'Alterar e-mail']) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  it('signs this device out from Sair da conta', async () => {
    mockAuthState.logout.mockImplementation(async () => updateMockAuthState({ status: 'anonymous' }));
    const { router } = await openSettings('/configuracao');

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));

    await waitFor(() => expect(router).toHavePathname('/entrar'));
    expect(mockAuthState.logout).toHaveBeenCalledTimes(1);
  });
});

describe('Configuração on phones', () => {
  beforeEach(async () => {
    await setViewport('android', 390);
  });

  it('opens from Mais and lists the sections in groups, keeping Mais lit', async () => {
    const router = renderRouter('src/app', { initialUrl: '/guilda' });
    await router;

    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Configuração' }));

    await waitFor(() => expect(router).toHavePathname('/configuracao'));
    await screen.findByTestId('settings-profile');
    expect(screen.getByRole('header', { name: 'Configuração' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mais' }).props.accessibilityState).toEqual({ selected: true });
    for (const group of ['CONTA', 'FOCO', 'SEGURANÇA', 'ACESSIBILIDADE', 'PLANO']) {
      expect(screen.getByRole('header', { name: group })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'Nome do guerreiro: Knightshade' })).toBeTruthy();
    expect(screen.getByLabelText('E-mail: knightshade@wise.app')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Plano atual: Free · premium em breve' })).toBeTruthy();
    expect(screen.getByText('PLANO FREE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();
    expect(screen.getByText('Wise Warrior · versão 0.1.0')).toBeTruthy();
    for (const hidden of ['Notificações', 'Meta diária', 'Tema', 'Senha', 'Alterar senha']) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  it.each([
    ['Nome do guerreiro: Knightshade', '/configuracao/conta', 'Conta e segurança'],
    ['Foco', '/configuracao/foco', 'Foco'],
    ['Dispositivos conectados', '/configuracao/dispositivos', 'Dispositivos'],
    ['Acessibilidade', '/configuracao/acessibilidade', 'Acessibilidade'],
    ['Plano atual: Free · premium em breve', '/configuracao/plano', 'Plano'],
  ])('opens the %s row on its own screen and returns with ‹ Configuração', async (row, pathname, title) => {
    const { router } = await openSettings('/configuracao');
    await screen.findByTestId('settings-profile');

    await fireEvent.press(screen.getByRole('link', { name: row }));
    await waitFor(() => expect(router).toHavePathname(pathname));
    expect(screen.getByRole('header', { name: title })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Configuração' }));
    await waitFor(() => expect(router).toHavePathname('/configuracao'));
    expect(screen.getByTestId('settings-list')).toBeTruthy();
  });

  it('keeps the list beneath a section opened by deep link, so the system back returns to it', async () => {
    const { router } = await openSettings('/configuracao/dispositivos');
    expect(screen.getByRole('header', { name: 'Dispositivos' })).toBeTruthy();

    await act(() => appRouter.back());

    await waitFor(() => expect(router).toHavePathname('/configuracao'));
    expect(screen.getByTestId('settings-list')).toBeTruthy();
  });

  it('signs this device out from Sair da conta', async () => {
    mockAuthState.logout.mockImplementation(async () => updateMockAuthState({ status: 'anonymous' }));
    const { router } = await openSettings('/configuracao');

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));

    await waitFor(() => expect(router).toHavePathname('/entrar'));
    expect(mockAuthState.logout).toHaveBeenCalledTimes(1);
  });
});
