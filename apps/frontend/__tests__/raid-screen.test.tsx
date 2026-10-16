import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { getActiveRaid, getMyGuild, getRaidRanking, type ActiveRaid, type MyGuild, type RaidRankingEntry } from '@/features/guild/api';
import { RaidBattleScreen } from '@/features/guild/raid-screen';

jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
  getRaidRanking: jest.fn(),
}));

const mockedMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const mockedRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;
const mockedRanking = getRaidRanking as jest.MockedFunction<typeof getRaidRanking>;

const HOUR = 60 * 60 * 1000;
const mine: MyGuild = {
  guild: { id: 'g1', name: 'Ordem dos Madrugadores', level: 7, memberCount: 23, leader: { userId: 'u1', displayName: 'Astaroth' } },
  role: 'member',
};
const entry = (position: number, name: string, xp: number, isMe = false): RaidRankingEntry => ({
  position, userId: `u-${name}`, displayName: name, level: 10 + position, title: null, avatar: null, accessory: null, contributionXp: xp, isMe,
});
const ranking = [entry(1, 'Astaroth', 14_520), entry(2, 'Eldoria', 12_660), entry(3, 'Ravenstone', 11_160), entry(4, 'Guilherme', 6_780, true), entry(5, 'Brisa', 600)];

const raid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'r1',
  mission: { slug: 'vigilia-da-aurora', name: 'Vigília da Aurora', description: 'Madrugue com a guilda.', imageUrl: null },
  rewards: [{ itemId: 'i1', name: 'Selo dos Madrugadores', category: 'accessory' }],
  coins: 50,
  party: ranking.slice(0, 5),
  goalXp: 120_000,
  progressXp: 82_800,
  startsAt: new Date(Date.now() - 3 * 24 * HOUR).toISOString(),
  endsAt: new Date(Date.now() + (3 * 24 + 14) * HOUR + 5 * 60_000).toISOString(),
  status: 'active',
  goalReachedAt: null,
  me: { participating: true, contributionXp: 6_780, position: 4 },
  ...overrides,
});
function setViewport(width: number, height: number) {
  Dimensions.set({ window: { width, height, scale: 1, fontScale: 1 } });
}

async function renderRaid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><RaidBattleScreen /></QueryClientProvider>);
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  setViewport(1440, 1024);
  mockedMine.mockResolvedValue(mine);
  mockedRaid.mockResolvedValue(raid());
  mockedRanking.mockResolvedValue({ items: ranking, nextCursor: null });
});
afterEach(() => { [mockedMine, mockedRaid, mockedRanking].forEach((mock) => mock.mockReset()); });

describe('RaidBattleScreen on desktop', () => {
  it('shows the Mission, the time left and the boss life in focus hours', async () => {
    await renderRaid();

    expect((await screen.findByTestId('raid-mission-name')).props.children).toBe('Vigília da Aurora');
    expect(screen.getByText('Raid semanal · Ordem dos Madrugadores')).toBeTruthy();
    expect(screen.getByText('Madrugue com a guilda.')).toBeTruthy();
    expect(screen.getByTestId('raid-layout-desktop')).toBeTruthy();
    expect(screen.getByTestId('raid-time-left').props.children).toBe('3d 14h restantes');
    expect(screen.getByTestId('raid-boss-life-percent').props.children).toEqual([31, '%']);
    expect(screen.getByTestId('raid-boss-life').props.accessibilityLabel).toBe('Vida do dragão: 31%. 138h de 200h de foco coletivo.');
    expect(screen.getByTestId('raid-focus-hours').props.children).toEqual(['138h', ' de ', '200h', ' de foco coletivo']);
  });

  it('draws the first five Participants in the scene and lists four strikes with your row', async () => {
    await renderRaid();

    expect(await screen.findByTestId('raid-scene-hero-u-Brisa', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('raid-scene-tag-u-Guilherme', { includeHiddenElements: true })).toBeTruthy();
    const strikes = within(screen.getByTestId('raid-strikes'));
    expect(strikes.getByTestId('raid-strike-u-Astaroth').props.accessibilityLabel).toBe('1º: Astaroth, 24,2h de foco');
    expect(strikes.getByTestId('raid-strike-u-Guilherme').props.accessibilityLabel).toBe('4º: você, 11,3h de foco');
    expect(strikes.queryByTestId('raid-strike-u-Brisa')).toBeNull();
  });

  it('keeps the scene out of the accessibility tree', async () => {
    await renderRaid();
    await screen.findByTestId('raid-mission-name');

    expect(screen.queryByTestId('raid-scene-background')).toBeNull();
    expect(screen.getByTestId('raid-scene-background', { includeHiddenElements: true })).toBeTruthy();
  });

  it('offers the Mission reward to everyone who contributes and opens the Forja in guild mode', async () => {
    await renderRaid();

    expect((await screen.findByTestId('raid-reward')).props.accessibilityLabel).toBe('Selo dos Madrugadores, +50 Moedas. Para todos que contribuírem.');
    const attack = screen.getByTestId('raid-attack');
    expect(attack.props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.getByRole('button', { name: /Atacar com foco/ })).toBeTruthy();
  });

  it('names a title reward as a Título', async () => {
    mockedRaid.mockResolvedValue(raid({ rewards: [{ itemId: 'i2', name: 'Caçador de Dragões', category: 'title' }] }));
    await renderRaid();

    expect((await screen.findByTestId('raid-reward')).props.accessibilityLabel).toBe('Título “Caçador de Dragões”, +50 Moedas. Para todos que contribuírem.');
  });

  it('lists every reward item with its sprite and the Moedas from the API', async () => {
    mockedRaid.mockResolvedValue(raid({
      rewards: [{ itemId: 'i1', name: 'Selo dos Madrugadores', category: 'accessory' }, { itemId: 'i3', name: 'Armadura do Lobo', category: 'avatar' }],
      coins: 80,
    }));
    await renderRaid();

    const rewards = within(await screen.findByTestId('raid-rewards'));
    expect(rewards.getByTestId('raid-reward-i1')).toBeTruthy();
    expect(rewards.getByTestId('raid-reward-i3')).toBeTruthy();
    expect(rewards.getByTestId('raid-reward-coins').props.children).toBe('+80 Moedas');
    expect(screen.queryByText(/para o tesouro/)).toBeNull();
  });

  it('draws the party from the Raid with the equipped look and falls back to the default scene art', async () => {
    const dressed = { ...entry(1, 'Astaroth', 14_520), avatar: { itemId: 'a1', name: 'Armadura do Lobo' }, accessory: { itemId: 'c1', name: 'Pena do Escriba' } };
    mockedRaid.mockResolvedValue(raid({ mission: { slug: 'missao-sem-arte', name: 'Sem Arte', description: 'x', imageUrl: null }, party: [dressed] }));
    await renderRaid();

    expect(await screen.findByTestId('raid-scene-accessory-u-Astaroth', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('raid-scene-hero-u-Astaroth', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('raid-scene-hero-u-Brisa', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('raid-scene-background', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the boss defeated once the goal is reached', async () => {
    mockedRaid.mockResolvedValue(raid({ progressXp: 121_000, goalReachedAt: new Date().toISOString() }));
    await renderRaid();

    expect((await screen.findByTestId('raid-boss-life-percent')).props.children).toEqual([0, '%']);
    expect(screen.getByTestId('raid-goal-reached')).toBeTruthy();
  });

  it('disables the attack when the week is over', async () => {
    mockedRaid.mockResolvedValue(raid({ endsAt: new Date(Date.now() - 1000).toISOString() }));
    await renderRaid();

    expect((await screen.findByTestId('raid-time-left')).props.children).toBe('Encerrando…');
    expect(screen.getByTestId('raid-attack').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('invites the first attack while nobody has contributed', async () => {
    mockedRanking.mockResolvedValue({ items: [], nextCursor: null });
    await renderRaid();

    expect(await screen.findByTestId('raid-strikes-empty')).toBeTruthy();
  });
});

describe('RaidBattleScreen on a phone', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'ios' });
    setViewport(390, 844);
  });

  it('stacks the life under the scene, lists three strikes and keeps the attack fixed at the bottom', async () => {
    await renderRaid();

    expect(await screen.findByTestId('raid-layout-mobile')).toBeTruthy();
    expect(screen.getByText('Raid semanal')).toBeTruthy();
    expect(screen.getByTestId('raid-time-left').props.children).toBe('3d 14h');
    expect(screen.getByTestId('raid-boss-life-percent').props.children).toEqual([31, '% · ', '138h', '/', '200h']);
    const strikes = within(screen.getByTestId('raid-strikes'));
    expect(strikes.getByText('Você · 4º')).toBeTruthy();
    expect(strikes.queryByTestId('raid-strike-u-Ravenstone')).toBeNull();
    expect(screen.queryByTestId('raid-scene-tag-u-Astaroth', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('raid-attack')).toBeTruthy();
  });
});

describe('RaidBattleScreen without a Raid to show', () => {
  it('explains that the user has no guild yet', async () => {
    mockedMine.mockResolvedValue(null);
    await renderRaid();

    expect(await screen.findByTestId('raid-no-guild')).toBeTruthy();
    expect(mockedRaid).not.toHaveBeenCalled();
  });

  it('explains that the guild has no Raid this week', async () => {
    mockedRaid.mockResolvedValue(null);
    await renderRaid();

    expect(await screen.findByTestId('raid-empty')).toBeTruthy();
  });

  it('offers a retry when the Raid cannot be loaded', async () => {
    mockedRaid.mockRejectedValueOnce(new ApiError('server', { status: 500 }));
    await renderRaid();

    await fireEvent.press(await screen.findByText('Tentar novamente'));
    expect(await screen.findByTestId('raid-mission-name')).toBeTruthy();
    expect(mockedRaid).toHaveBeenCalledTimes(2);
  });
});
