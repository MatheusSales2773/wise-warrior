import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getActiveRaid, getMyGuild, getRaidRanking, joinGuild, joinRaid, leaveGuild, listGuildMembers, listGuilds, listPastRaids, type ActiveRaid, type PastRaid, type GuildMemberPage, type GuildPage, type MyGuild, type RaidRankingEntry, type RaidRankingPage } from '@/features/guild/api';
import { GuildScreen } from '@/features/guild/guild-screen';
import { GUILD_NAME_MAX_LENGTH, GUILD_NAME_MIN_LENGTH } from '@/features/guild/validation';

jest.mock('@/features/dashboard/api', () => ({ getMyProfile: jest.fn(() => new Promise(() => undefined)) }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
  getRaidRanking: jest.fn(),
  listPastRaids: jest.fn(),
  listGuilds: jest.fn(),
  createGuild: jest.fn(),
  joinGuild: jest.fn(),
  joinRaid: jest.fn(),
  listGuildMembers: jest.fn(),
  leaveGuild: jest.fn(),
}));

const mockedMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const mockedList = listGuilds as jest.MockedFunction<typeof listGuilds>;
const mockedCreate = createGuild as jest.MockedFunction<typeof createGuild>;
const mockedJoin = joinGuild as jest.MockedFunction<typeof joinGuild>;
const mockedMembers = listGuildMembers as jest.MockedFunction<typeof listGuildMembers>;
const mockedLeave = leaveGuild as jest.MockedFunction<typeof leaveGuild>;
const mockedJoinRaid = joinRaid as jest.MockedFunction<typeof joinRaid>;
const mockedRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;
const mockedRanking = getRaidRanking as jest.MockedFunction<typeof getRaidRanking>;
const mockedPast = listPastRaids as jest.MockedFunction<typeof listPastRaids>;

const DAY = 24 * 60 * 60 * 1000;
const raid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'r1',
  mission: { slug: 'cerco-ao-grimorio', name: 'Cerco ao Grimório', description: 'Cerque os capítulos mais difíceis.', imageUrl: null },
  rewards: [{ itemId: 'i1', name: 'Marcador do Grimório', category: 'badge' }],
  coins: 50,
  party: [],
  goalXp: 1000,
  progressXp: 250,
  startsAt: new Date(Date.now() - 2 * DAY).toISOString(),
  endsAt: new Date(Date.now() + 2 * DAY + 3.5 * 60 * 60 * 1000).toISOString(),
  status: 'active',
  goalReachedAt: null,
  regeneratedXp: 0,
  healthXp: 0,
  furyPercent: 5,
  weekDays: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  today: '2026-10-07',
  studyDays: [],
  streak: 0,
  me: { participating: false, contributionXp: 0, position: null },
  lastHit: null,
  ...overrides,
});

const mine: MyGuild = {
  guild: { id: 'g1', name: 'Ordem do Foco', level: 2, memberCount: 3, leader: { userId: 'u1', displayName: 'Ana' } },
  role: 'leader',
};
const members = (names: string[], nextCursor: string | null = null): GuildMemberPage => ({
  items: names.map((name, index) => ({
    userId: `u-${name}`, displayName: name, level: index + 2, title: index === 0 ? 'Aprendiz' : null,
    role: index === 0 ? 'leader' : 'member', joinedAt: '2026-09-01T10:00:00Z',
  })),
  nextCursor,
});
const page = (names: string[], nextCursor: string | null = null): GuildPage => ({
  items: names.map((name, index) => ({ id: `id-${name}`, name, level: 1, memberCount: index + 1 })),
  nextCursor,
});

async function renderGuild() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><GuildScreen /></QueryClientProvider>);
  return Object.assign(view, { client });
}

async function openTab(id: 'raid' | 'mural' | 'members' | 'history') {
  await fireEvent.press(await screen.findByTestId(`guild-tab-${id}`));
}

async function openJoinTab(id: 'search' | 'create') {
  await fireEvent.press(await screen.findByTestId(`guild-join-tab-${id}`));
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  Dimensions.set({ window: { width: 390, height: 844, scale: 1, fontScale: 1 } });
  mockedRaid.mockResolvedValue(raid());
  mockedRanking.mockResolvedValue({ items: [], nextCursor: null });
  mockedPast.mockResolvedValue({ items: [], nextCursor: null });
});
afterEach(() => { jest.clearAllMocks(); [mockedRaid, mockedRanking, mockedPast, mockedMine, mockedList, mockedCreate, mockedJoin, mockedMembers, mockedLeave, mockedJoinRaid].forEach((mock) => mock.mockReset()); });

describe('GuildScreen', () => {
  it('shows the header of a Leader with emblem, level, size and role seal', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    expect((await screen.findByTestId('guild-mine-name')).props.children).toBe('Ordem do Foco');
    expect(within(screen.getByTestId('guild-mine')).getByTestId('guild-emblem', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('guild-mine-stats').props.children).toBe('NÍVEL 2 · 3 MEMBROS · 1 RAID VENCIDA');
    expect(within(screen.getByTestId('guild-mine-role')).getByText('VOCÊ É LÍDER')).toBeTruthy();
    expect(screen.queryByTestId('guild-create')).toBeNull();
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('shows the MEMBRO seal for a member and hides the won Raids at Level 1', async () => {
    mockedMine.mockResolvedValue({ role: 'member', guild: { ...mine.guild, level: 1 } });
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    expect(within(await screen.findByTestId('guild-mine-role')).getByText('MEMBRO')).toBeTruthy();
    expect(screen.getByTestId('guild-mine-stats').props.children).toBe('NÍVEL 1 · 3 MEMBROS');
  });

  it('pluralises the won Raids from Level 3 on', async () => {
    mockedMine.mockResolvedValue({ ...mine, guild: { ...mine.guild, level: 4, memberCount: 1 } });
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    expect((await screen.findByTestId('guild-mine-stats')).props.children).toBe('NÍVEL 4 · 1 MEMBRO · 3 RAIDS VENCIDAS');
  });

  it('keeps the leave error messages of the header action', async () => {
    mockedMine.mockResolvedValue({ ...mine, role: 'member' });
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedLeave.mockRejectedValueOnce(new ApiError('network', { status: 0 }));
    await renderGuild();

    await fireEvent.press(await screen.findByTestId('guild-leave'));
    await fireEvent.press(screen.getByTestId('guild-leave-confirm-button'));
    expect(await screen.findByText('Não foi possível sair da guilda. Verifique sua conexão e tente novamente.')).toBeTruthy();
  });

  it('lists the members with level and title and loads further pages', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValueOnce(members(['Ana', 'Bruno'], 'next'));
    await renderGuild();
    await openTab('members');

    expect(await screen.findByTestId('guild-member-u-Ana')).toBeTruthy();
    expect(screen.getByText('Nv 2')).toBeTruthy();
    expect(screen.getByTestId('guild-member-u-Bruno')).toBeTruthy();
    expect(screen.getByTestId('guild-members-count')).toHaveTextContent('3');
    expect(screen.getByTestId('guild-member-portrait-u-Ana')).toBeTruthy();

    mockedMembers.mockResolvedValueOnce({ items: [{ ...members(['Carla']).items[0]!, role: 'member' }], nextCursor: null });
    await fireEvent.press(screen.getByTestId('guild-members-more'));
    expect(await screen.findByTestId('guild-member-u-Carla')).toBeTruthy();
    expect(mockedMembers).toHaveBeenLastCalledWith('g1', expect.objectContaining({ cursor: 'next' }));
  });

  it('marks only the Leader with the LÍDER seal and keeps the row readable', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana', 'Bruno']));
    await renderGuild();
    await openTab('members');

    expect(await screen.findByTestId('guild-member-seal-u-Ana')).toHaveTextContent('LÍDER');
    expect(screen.queryByTestId('guild-member-seal-u-Bruno')).toBeNull();
    expect(screen.getByTestId('guild-member-u-Ana')).toHaveProp('accessibilityLabel', expect.stringContaining('Líder'));
  });

  it('shows no Presença, no online count and only the level while the connection is unknown', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();
    await openTab('members');

    expect(await screen.findByText('Nv 2')).toBeTruthy();
    expect(screen.queryByTestId('guild-member-online-u-Ana')).toBeNull();
    expect(screen.queryByTestId('guild-member-offline-u-Ana')).toBeNull();
    expect(screen.getByTestId('guild-members-count')).toHaveTextContent(/^3$/);
  });

  it('shows an empty state when the guild has no members to list', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue({ items: [], nextCursor: null });
    await renderGuild();
    await openTab('members');

    expect(await screen.findByTestId('guild-members-empty')).toBeTruthy();
  });

  it('keeps the guild visible when the members cannot be loaded', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderGuild();
    await openTab('members');

    expect(await screen.findByTestId('guild-members-error')).toBeTruthy();
    expect(screen.getByTestId('guild-mine')).toBeTruthy();
  });

  it('asks for confirmation, then leaves the guild and goes back to the join options', async () => {
    mockedMine.mockResolvedValueOnce(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedList.mockResolvedValue(page(['Alfa']));
    mockedLeave.mockResolvedValue(undefined);
    await renderGuild();

    await fireEvent.press(await screen.findByTestId('guild-leave'));
    expect(screen.getByText(/a liderança passa ao membro mais antigo/)).toBeTruthy();
    expect(mockedLeave).not.toHaveBeenCalled();

    mockedMine.mockResolvedValue(null);
    await fireEvent.press(screen.getByTestId('guild-leave-confirm-button'));

    await waitFor(() => expect(mockedLeave).toHaveBeenCalledWith('g1'));
    expect(await screen.findByTestId('guild-join-tabs')).toBeTruthy();
  });

  it('lets the user back out of leaving and reports a failed leave', async () => {
    mockedMine.mockResolvedValue({ ...mine, role: 'member' });
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedLeave.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderGuild();

    await fireEvent.press(await screen.findByTestId('guild-leave'));
    expect(screen.getByText('Tem certeza de que quer sair da guilda?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guild-leave-cancel'));
    expect(screen.queryByTestId('guild-leave-confirm')).toBeNull();

    await fireEvent.press(screen.getByTestId('guild-leave'));
    await fireEvent.press(screen.getByTestId('guild-leave-confirm-button'));
    expect(await screen.findByTestId('guild-leave-error')).toBeTruthy();
    expect(screen.getByTestId('guild-mine')).toBeTruthy();
  });

  describe('sem guilda (Figma 06d)', () => {
    it('shows the heading, the explanation and the Procurar tab with the directory on a phone', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa', 'Beta']));
      await renderGuild();

      expect(await screen.findByText('Escolha sua ordem')).toBeTruthy();
      expect(screen.getByText('Você ainda não tem uma guilda. Entre em uma aberta ou funde a sua e chame os amigos.')).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Procurar' }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
      expect(screen.getByRole('tab', { name: 'Fundar' }).props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
      expect(await screen.findByTestId('guild-directory-item-id-Alfa')).toBeTruthy();
      expect(screen.getByTestId('guild-directory-item-id-Beta')).toBeTruthy();
      for (const id of ['id-Alfa', 'id-Beta']) {
        expect(within(screen.getByTestId(`guild-directory-item-${id}`)).getByTestId('guild-emblem', { includeHiddenElements: true })).toBeTruthy();
      }
      expect(screen.queryByTestId('guild-create')).toBeNull();
      expect(screen.queryByTestId('guild-how-it-works')).toBeNull();
    });

    it('switches to Fundar: the creation form and the "Como funciona" card replace the directory', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();
      await screen.findByTestId('guild-directory-item-id-Alfa');

      await openJoinTab('create');

      expect(screen.getByRole('tab', { name: 'Fundar' }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
      expect(screen.getByTestId('guild-create')).toBeTruthy();
      const how = screen.getByTestId('guild-how-it-works');
      ['Raid semanal', 'Mural', 'Recompensas', 'Cada aventureiro participa de uma guilda por vez.'].forEach((text) => expect(within(how).getByText(text)).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Fundar guilda' })).toBeTruthy();
      expect(screen.queryByTestId('guild-directory-item-id-Alfa')).toBeNull();
    });

    it('keeps the typed name and the search when going back and forth between the tabs', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();
      await screen.findByTestId('guild-directory-item-id-Alfa');

      await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), 'alf');
      await openJoinTab('create');
      await fireEvent.changeText(screen.getByLabelText('Nome da guilda'), 'Ordem Nova');
      expect(screen.getByText('10 / 60', { includeHiddenElements: true })).toBeTruthy();
      await openJoinTab('search');
      expect(screen.getByLabelText('Buscar por nome').props.value).toBe('alf');
      await openJoinTab('create');
      expect(screen.getByLabelText('Nome da guilda').props.value).toBe('Ordem Nova');
    });

    it('shows no tabs on desktop: the directory on the left, the creation form and "Como funciona" on the right', async () => {
      Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();

      expect(await screen.findByTestId('guild-join-desktop')).toBeTruthy();
      expect(screen.queryByTestId('guild-join-tabs')).toBeNull();
      expect(screen.getByText('Escolha sua ordem')).toBeTruthy();
      expect(screen.getByText('Entrada aberta')).toBeTruthy();
      expect(await screen.findByTestId('guild-directory-item-id-Alfa')).toBeTruthy();
      expect(screen.getByTestId('guild-create')).toBeTruthy();
      expect(screen.getByTestId('guild-how-it-works')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), ' beta ');
      await fireEvent.press(screen.getByTestId('guild-directory-search-submit'));
      await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'beta' })));
      expect(within(screen.getByTestId('guild-directory-item-id-Alfa')).getByTestId('guild-emblem', { includeHiddenElements: true })).toBeTruthy();
    });

    it('searches on a phone with the keyboard submit, with no "Buscar" button as in the Figma', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();
      await screen.findByTestId('guild-directory-item-id-Alfa');

      expect(screen.queryByTestId('guild-directory-search-submit')).toBeNull();
      await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), ' beta ');
      await fireEvent(screen.getByLabelText('Buscar por nome'), 'submitEditing');
      await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'beta' })));
    });

    it('searches by itself after the user stops typing, with no submit', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();
      await screen.findByTestId('guild-directory-item-id-Alfa');
      mockedList.mockClear();

      mockedList.mockResolvedValue(page(['Beta']));
      await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), 'b');
      await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), ' be ');
      expect(mockedList).not.toHaveBeenCalled();
      expect(await screen.findByTestId('guild-directory-item-id-Beta')).toBeTruthy();
      expect(mockedList).toHaveBeenCalledTimes(1);
      expect(mockedList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'be' }));
    });

    it('states the name rule from the validation constants and counts the typed characters', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page([]));
      await renderGuild();
      await openJoinTab('create');

      expect(screen.getByText(`${GUILD_NAME_MIN_LENGTH} a ${GUILD_NAME_MAX_LENGTH} caracteres`)).toBeTruthy();
      expect(screen.getByText(`0 / ${GUILD_NAME_MAX_LENGTH}`, { includeHiddenElements: true })).toBeTruthy();
    });

    it('marks each tab panel and hides the one that is not open', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page(['Alfa']));
      await renderGuild();
      await screen.findByTestId('guild-directory-item-id-Alfa');

      const panel = (id: 'search' | 'create') => screen.getByTestId(`guild-join-panel-${id}`, { includeHiddenElements: true });
      const hidden = (id: 'search' | 'create') => StyleSheet.flatten(panel(id).props.style)?.display === 'none';
      expect(panel('search').props.role).toBe('tabpanel');
      expect(panel('create').props.role).toBe('tabpanel');
      expect([hidden('search'), hidden('create')]).toEqual([false, true]);

      await openJoinTab('create');
      expect([hidden('search'), hidden('create')]).toEqual([true, false]);
      expect(screen.queryByTestId('guild-directory')).toBeNull();
    });

    it('keeps the screen title while the guild loads and swaps it for the heading once the user is known to have none', async () => {
      let resolveMine: (value: MyGuild | null) => void = () => undefined;
      mockedMine.mockReturnValue(new Promise((resolve) => { resolveMine = resolve; }));
      mockedList.mockResolvedValue(page([]));
      await renderGuild();
      expect(await screen.findByText('Carregando sua guilda…')).toBeTruthy();
      expect(screen.getByTestId('guild-title')).toBeTruthy();
      expect(screen.queryByText('Escolha sua ordem')).toBeNull();

      resolveMine(null);
      expect(await screen.findByText('Escolha sua ordem')).toBeTruthy();
      expect(screen.queryByTestId('guild-title')).toBeNull();
    });

    it('shows the loading state of the directory', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockReturnValue(new Promise(() => undefined));
      await renderGuild();
      expect(await screen.findByTestId('guild-directory-loading')).toBeTruthy();
    });

    it('shows the empty state of the directory', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockResolvedValue(page([]));
      await renderGuild();
      expect(await screen.findByText('Ainda não há guildas. Funde a primeira!')).toBeTruthy();
    });

    it('shows a retryable error when the directory cannot be loaded', async () => {
      mockedMine.mockResolvedValue(null);
      mockedList.mockRejectedValue(new ApiError('network'));
      await renderGuild();
      expect(await screen.findByTestId('guild-directory-error')).toBeTruthy();
    });
  });

  it('validates the name before calling the API, then creates and shows the new guild', async () => {
    mockedMine.mockResolvedValueOnce(null);
    mockedList.mockResolvedValue(page([]));
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedCreate.mockResolvedValue(undefined);
    await renderGuild();
    await openJoinTab('create');

    await fireEvent.press(screen.getByTestId('guild-create-submit'));
    expect(await screen.findByText('Dê um nome à sua guilda.')).toBeTruthy();
    expect(mockedCreate).not.toHaveBeenCalled();

    mockedMine.mockResolvedValue(mine);
    await fireEvent.changeText(screen.getByLabelText('Nome da guilda'), '  Ordem do Foco ');
    await fireEvent.press(screen.getByTestId('guild-create-submit'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith('Ordem do Foco', expect.anything()));
    expect(await screen.findByTestId('guild-mine')).toBeTruthy();
  });

  it('explains a creation conflict without leaking backend text', async () => {
    mockedMine.mockResolvedValue(null);
    mockedList.mockResolvedValue(page([]));
    mockedCreate.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    await renderGuild();
    await openJoinTab('create');

    await fireEvent.changeText(screen.getByLabelText('Nome da guilda'), 'Repetida');
    await fireEvent.press(screen.getByTestId('guild-create-submit'));

    expect(await screen.findByTestId('guild-create-error')).toBeTruthy();
    expect(screen.getByText(/Já existe uma guilda com esse nome/)).toBeTruthy();
  });

  it('joins a guild from the directory and switches to the member view', async () => {
    mockedMine.mockResolvedValueOnce(null);
    mockedList.mockResolvedValue(page(['Alfa']));
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedJoin.mockResolvedValue(undefined);
    await renderGuild();

    const join = await screen.findByTestId('guild-join-id-Alfa');
    mockedMine.mockResolvedValue({ ...mine, role: 'member' });
    await fireEvent.press(join);

    await waitFor(() => expect(mockedJoin).toHaveBeenCalledWith('id-Alfa', expect.anything()));
    expect(await screen.findByTestId('guild-mine')).toBeTruthy();
    expect(screen.getByText('MEMBRO')).toBeTruthy();
  });

  it('shows a join conflict and keeps the directory', async () => {
    mockedMine.mockResolvedValue(null);
    mockedList.mockResolvedValue(page(['Alfa']));
    mockedJoin.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    await renderGuild();

    await fireEvent.press(await screen.findByTestId('guild-join-id-Alfa'));

    expect(await screen.findByText('Você já participa de uma guilda.')).toBeTruthy();
    expect(screen.getByTestId('guild-directory-item-id-Alfa')).toBeTruthy();
  });

  it('shows the join failure message inside the Procurar tab and lets the user try again', async () => {
    mockedMine.mockResolvedValue(null);
    mockedList.mockResolvedValue(page(['Alfa']));
    mockedJoin.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderGuild();

    await fireEvent.press(await screen.findByTestId('guild-join-id-Alfa'));

    const error = await screen.findByTestId('guild-join-error');
    expect(within(screen.getByTestId('guild-directory')).getByTestId('guild-join-error')).toBe(error);
    expect(screen.getByText('Não foi possível entrar')).toBeTruthy();
    expect(screen.getByTestId('guild-join-id-Alfa')).toBeTruthy();
  });

  it('reloads the guild when joining reveals the user already belongs to one', async () => {
    mockedMine.mockResolvedValueOnce(null);
    mockedList.mockResolvedValue(page(['Alfa']));
    mockedJoin.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    mockedMine.mockResolvedValue({ ...mine, role: 'member' });
    await fireEvent.press(await screen.findByTestId('guild-join-id-Alfa'));

    expect(await screen.findByTestId('guild-mine')).toBeTruthy();
    expect(screen.queryByTestId('guild-create')).toBeNull();
  });

  it('searches by name and loads further pages', async () => {
    mockedMine.mockResolvedValue(null);
    mockedList.mockResolvedValueOnce(page(['Alfa'], 'next'));
    await renderGuild();
    await screen.findByTestId('guild-directory-item-id-Alfa');

    mockedList.mockResolvedValueOnce(page(['Beta']));
    await fireEvent.press(screen.getByTestId('guild-directory-more'));
    expect(await screen.findByTestId('guild-directory-item-id-Beta')).toBeTruthy();
    expect(mockedList).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }));

    mockedList.mockResolvedValue(page([]));
    await fireEvent.changeText(screen.getByLabelText('Buscar por nome'), ' zzz ');
    await fireEvent(screen.getByLabelText('Buscar por nome'), 'submitEditing');
    expect(await screen.findByText('Nenhuma guilda encontrada para essa busca.')).toBeTruthy();
    expect(mockedList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'zzz' }));
  });

  it('shows a retryable error when the guild cannot be loaded', async () => {
    mockedMine.mockRejectedValueOnce(new ApiError('server', { status: 500 }));
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    expect(await screen.findByTestId('guild-error')).toBeTruthy();
    mockedMine.mockResolvedValue(mine);
    await fireEvent.press(screen.getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('guild-mine')).toBeTruthy();
  });

  describe('Raid da semana', () => {
    beforeEach(() => {
      mockedMine.mockResolvedValue(mine);
      mockedMembers.mockResolvedValue(members(['Ana']));
    });

    it('counts what the Fúria gave back in the goal of the boss life', async () => {
      mockedRaid.mockResolvedValue(raid({ progressXp: 250, regeneratedXp: 100, healthXp: 850 }));
      await renderGuild();

      const bar = await screen.findByTestId('guild-raid-boss-life');
      expect(bar.props.accessibilityLabel).toBe('Vida do dragão: 85%. 0,4h de 1,8h de foco coletivo.');
      expect(screen.getByTestId('guild-raid-boss-life-percent')).toHaveTextContent('85%');
      expect(screen.getByTestId('guild-raid-focus-hours')).toHaveTextContent('1,4h de vida · 0,4h de 1,8h de foco coletivo');
    });

    it('shows the Missão, the boss life with an accessible bar, the time left and the reward summary on a phone', async () => {
      await renderGuild();

      expect(await screen.findByText('Cerco ao Grimório')).toBeTruthy();
      expect(mockedRaid).toHaveBeenCalledWith('g1', expect.anything());
      // The Figma hides the description, the scene chip and the Golpe on the phone; the countdown moves to the header.
      expect(screen.queryByText('Cerque os capítulos mais difíceis.')).toBeNull();
      expect(screen.queryByTestId('guild-raid-last-hit')).toBeNull();
      expect(screen.queryByTestId('guild-raid-ends')).toBeNull();

      const bar = screen.getByTestId('guild-raid-boss-life');
      expect(bar.props.accessibilityRole).toBe('progressbar');
      expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
      expect(screen.getByTestId('guild-raid-boss-life-percent')).toHaveTextContent('0%');
      expect(screen.getByTestId('guild-raid-time-left').props.children).toBe('2d 3h restantes');
      expect(within(screen.getByTestId('guild-raid-reward')).getByText('Marcador do Grimório e +50 Moedas')).toBeTruthy();
      expect(screen.queryByTestId('guild-raid-goal-reached')).toBeNull();
    });

    it('shows the description, the end of the week, the Golpe mais recente and the scene on desktop', async () => {
      Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
      mockedRaid.mockResolvedValue(raid({
        lastHit: { userId: 'u2', displayName: 'Eldoria', xp: 75, focusMinutes: 25, at: new Date().toISOString() },
      }));
      await renderGuild();

      expect(await screen.findByText('Cerque os capítulos mais difíceis.')).toBeTruthy();
      expect(screen.getByTestId('guild-raid-ends')).toHaveTextContent(/^Termina .+ · \d{2}:\d{2}$/);
      expect(screen.getByTestId('guild-raid-last-hit')).toHaveTextContent('ÚLTIMO GOLPE−75 · Eldoria · 25 min');
      expect(screen.getByTestId('guild-raid-time-left')).toHaveTextContent('2d 3h restantes');
      expect(screen.getByTestId('guild-raid-image')).toBeTruthy();
    });

    it('draws the week of the Sequência and the streak of the Guild', async () => {
      mockedRaid.mockResolvedValue(raid({ studyDays: ['2026-10-05', '2026-10-06'], streak: 2 }));
      await renderGuild();

      expect(await screen.findByTestId('guild-raid-streak')).toHaveTextContent('2 dias sem falhar');
      expect(screen.getAllByTestId('raid-week-day-studied')).toHaveLength(2);
      expect(screen.getAllByTestId('raid-week-day-today')).toHaveLength(1);
    });

    describe('"Ao derrotar" card', () => {
      it('lists each reward with its kind, the Moedas for every Participante and the rule', async () => {
        mockedRaid.mockResolvedValue(raid({ rewards: [{ itemId: 'i1', name: 'Caçador de Dragões', category: 'title' }, { itemId: 'i2', name: 'Escama Rubra', category: 'accessory' }] }));
        await renderGuild();

        await screen.findByTestId('guild-reward-i1');
        const card = screen.getByTestId('guild-rewards');
        expect(within(screen.getByTestId('guild-reward-i1')).getByText('Título “Caçador de Dragões”')).toBeTruthy();
        expect(within(screen.getByTestId('guild-reward-i1')).getByText('Título')).toBeTruthy();
        expect(within(screen.getByTestId('guild-reward-i2')).getByText('Escama Rubra')).toBeTruthy();
        expect(within(screen.getByTestId('guild-reward-i2')).getByText('Acessório')).toBeTruthy();
        expect(within(screen.getByTestId('guild-reward-coins')).getByText('+50 Moedas')).toBeTruthy();
        expect(within(screen.getByTestId('guild-reward-coins')).getByText('Para cada Participante')).toBeTruthy();
        expect(within(card).getByText(/contribua com ao menos uma sessão de guilda/)).toBeTruthy();
        expect(within(screen.getByTestId('guild-raid-reward')).getByText('Título “Caçador de Dragões”, Escama Rubra e +50 Moedas')).toBeTruthy();
      });

      it('says there is no Raid this week instead of listing rewards', async () => {
        mockedRaid.mockResolvedValue(null);
        await renderGuild();

        expect(await screen.findByTestId('guild-rewards-empty')).toBeTruthy();
        expect(screen.queryByTestId('guild-reward-coins')).toBeNull();
      });

      it('reports the Raid failing to load and leaves the retry to the Raid card', async () => {
        mockedRaid.mockRejectedValue(new Error('boom'));
        await renderGuild();

        expect(await screen.findByTestId('guild-rewards-error')).toBeTruthy();
        expect(screen.getAllByText('Tentar novamente')).toHaveLength(1);
      });
    });

    it('shows "Meta batida" once the goal is reached, with the boss life at zero', async () => {
      mockedRaid.mockResolvedValue(raid({ progressXp: 1250, goalReachedAt: new Date(Date.now() - DAY).toISOString() }));
      await renderGuild();

      expect(await screen.findByTestId('guild-raid-goal-reached')).toHaveTextContent(/Meta batida!/);
      expect(screen.getByTestId('guild-raid-boss-life-percent')).toHaveTextContent('0%');
    });

    describe('participation', () => {
      it('offers "Participar da Raid" and, once confirmed, swaps it for "Atacar com foco" without a refetch', async () => {
        mockedJoinRaid.mockResolvedValue(undefined);
        await renderGuild();

        expect(await screen.findByText('Participar da Raid')).toBeTruthy();
        expect(screen.queryByTestId('guild-raid-attack')).toBeNull();
        expect(screen.getByTestId('guild-raid-my-contribution')).toHaveTextContent('Ainda não participa');
        fireEvent.press(await screen.findByTestId('guild-raid-join'));

        expect(await screen.findByTestId('guild-raid-attack')).toBeTruthy();
        expect(screen.getByTestId('guild-raid-my-contribution')).toHaveTextContent('0,0h');
        expect(screen.queryByTestId('guild-raid-join')).toBeNull();
        expect(mockedJoinRaid).toHaveBeenCalledTimes(1);
        expect(mockedJoinRaid).toHaveBeenCalledWith('r1');
        expect(mockedRaid).toHaveBeenCalledTimes(1);
      });

      it('shows "Atacar com foco" straight away for a Participante, with no join button', async () => {
        mockedRaid.mockResolvedValue(raid({ me: { participating: true, contributionXp: 0, position: 1 } }));
        await renderGuild();

        const attack = await screen.findByTestId('guild-raid-attack');
        expect(attack.props.accessibilityState).toMatchObject({ disabled: false });
        expect(screen.queryByTestId('guild-raid-join')).toBeNull();
      });

      it('shows the Participante own Contribution in hours with the place in the ranking', async () => {
        mockedRaid.mockResolvedValue(raid({ me: { participating: true, contributionXp: 6780, position: 4 } }));
        await renderGuild();

        expect(await screen.findByTestId('guild-raid-my-contribution')).toHaveTextContent('11,3h · 4º lugar');
        expect(screen.getByTestId('guild-raid-contribution')).toHaveTextContent(/Dia inteiro sem estudo devolve 5% da vida ao dragão\.$/);
      });

      it('offers nothing to join once the Raid has expired', async () => {
        mockedRaid.mockResolvedValue(raid({ status: 'expired' }));
        await renderGuild();

        await screen.findByTestId('guild-raid-battle');
        expect(screen.queryByTestId('guild-raid-join')).toBeNull();
        expect(screen.queryByTestId('guild-raid-attack')).toBeNull();
      });

      it('sends a single request on repeated presses while the first is in flight', async () => {
        let resolve: () => void = () => undefined;
        mockedJoinRaid.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
        await renderGuild();

        const button = await screen.findByTestId('guild-raid-join');
        fireEvent.press(button);
        await waitFor(() => expect(mockedJoinRaid).toHaveBeenCalledTimes(1));
        fireEvent.press(screen.getByTestId('guild-raid-join'));
        expect(mockedJoinRaid).toHaveBeenCalledTimes(1);
        resolve();
        expect(await screen.findByTestId('guild-raid-attack')).toBeTruthy();
      });

      it('explains a Raid that already ended and reloads the Raid (UC02 A01)', async () => {
        mockedJoinRaid.mockRejectedValue(new ApiError('conflict', { status: 409 }));
        await renderGuild();
        const button = await screen.findByTestId('guild-raid-join');

        mockedRaid.mockResolvedValue(raid({ id: 'r2', mission: { slug: 'marcha-do-silencio', name: 'Marcha do Silêncio', description: 'Marche.', imageUrl: null } }));
        fireEvent.press(button);

        expect(await screen.findByText('Marcha do Silêncio')).toBeTruthy();
        await waitFor(() => expect(mockedRaid).toHaveBeenCalledTimes(2));
      });

      it('shows the message of a Raid that ended while the reload has not arrived yet', async () => {
        mockedJoinRaid.mockRejectedValue(new ApiError('conflict', { status: 409 }));
        await renderGuild();

        const button = await screen.findByTestId('guild-raid-join');
        mockedRaid.mockReturnValue(new Promise(() => undefined));
        fireEvent.press(button);

        expect(await screen.findByTestId('guild-raid-join-error')).toBeTruthy();
        expect(screen.getByText(/já foi encerrada/)).toBeTruthy();
      });

      it('tells a non-member (403) they cannot participate and keeps the button', async () => {
        mockedJoinRaid.mockRejectedValue(new ApiError('unexpected', { status: 403 }));
        await renderGuild();

        fireEvent.press(await screen.findByTestId('guild-raid-join'));

        expect(await screen.findByText(/Apenas membros da guilda podem participar/)).toBeTruthy();
        expect(screen.getByTestId('guild-raid-join')).toBeTruthy();
        expect(mockedRaid).toHaveBeenCalledTimes(1);
      });

      it('lets the member retry after a network failure', async () => {
        mockedJoinRaid.mockRejectedValueOnce(new ApiError('network', {})).mockResolvedValueOnce(undefined);
        await renderGuild();

        fireEvent.press(await screen.findByTestId('guild-raid-join'));
        expect(await screen.findByText(/Verifique sua conexão/)).toBeTruthy();
        fireEvent.press(screen.getByTestId('guild-raid-join'));

        expect(await screen.findByTestId('guild-raid-attack')).toBeTruthy();
        expect(screen.queryByTestId('guild-raid-join-error')).toBeNull();
      });
    });

    it('links the Raid card to the battle screen', async () => {
      await renderGuild();
      const battle = await screen.findByTestId('guild-raid-battle');
      expect(battle.props.accessibilityLabel).toBe('Ver a batalha da Raid Cerco ao Grimório');
    });

    it('says the Raid is ending once the time left reaches zero', async () => {
      mockedRaid.mockResolvedValue(raid({ endsAt: new Date(Date.now() - 1000).toISOString() }));
      await renderGuild();
      expect((await screen.findByTestId('guild-raid-time-left')).props.children).toBe('Encerrando…');
    });

    it('shows a loading state while the Raid loads', async () => {
      mockedRaid.mockReturnValue(new Promise(() => undefined));
      await renderGuild();
      expect(await screen.findByTestId('guild-raid-loading')).toBeTruthy();
      expect(screen.getByTestId('guild-mine')).toBeTruthy();
    });

    it('shows an empty state when the Guild has no Raid this week', async () => {
      mockedRaid.mockResolvedValue(null);
      await renderGuild();
      expect(await screen.findByTestId('guild-raid-empty')).toBeTruthy();
    });

    it('shows a retryable error without hiding the rest of the screen', async () => {
      mockedRaid.mockRejectedValueOnce(new ApiError('server', { status: 500 }));
      await renderGuild();
      expect(await screen.findByTestId('guild-raid-error')).toBeTruthy();
      expect(screen.getByTestId('guild-tabs')).toBeTruthy();

      await fireEvent.press(screen.getByText('Tentar novamente'));
      expect(await screen.findByText('Cerco ao Grimório')).toBeTruthy();
    });

    it('keeps the last Raid on screen and warns that it is outdated when a refresh fails', async () => {
      const view = await renderGuild();
      await screen.findByText('Cerco ao Grimório');

      mockedRaid.mockRejectedValue(new ApiError('network', {}));
      await view.client.refetchQueries({ queryKey: ['guild', 'raid', 'g1'] });

      expect(await screen.findByTestId('guild-raid-stale')).toBeTruthy();
      expect(screen.getByText('Cerco ao Grimório')).toBeTruthy();
    });

    it('shows one section at a time on a phone: Raid | Mural | Membros | Histórico, opening on the Raid', async () => {
      await renderGuild();
      await screen.findByText('Cerco ao Grimório');
      expect(screen.getByTestId('guild-layout-tabs')).toBeTruthy();
      expect(screen.queryByTestId('guild-column-main')).toBeNull();
      expect(within(screen.getByTestId('guild-tabs')).getAllByRole('tab').map((tab) => tab.props.testID))
        .toEqual(['guild-tab-raid', 'guild-tab-mural', 'guild-tab-members', 'guild-tab-history']);
      expect(screen.getByTestId('guild-tab-raid')).toBeSelected();
      expect(screen.getByTestId('guild-mine')).toBeTruthy();
      expect(screen.getByTestId('guild-leave-section')).toBeTruthy();

      const sections = { raid: 'guild-raid', mural: 'guild-mural', members: 'guild-members', history: 'guild-past-raids' } as const;
      for (const [tab, visible] of Object.entries(sections) as [keyof typeof sections, string][]) {
        await openTab(tab);
        expect(screen.getByTestId(`guild-tab-${tab}`)).toBeSelected();
        expect(await screen.findByTestId(visible)).toBeTruthy();
        for (const hidden of Object.values(sections).filter((id) => id !== visible)) expect(screen.queryByTestId(hidden)).toBeNull();
        // The guild header stays above every tab.
        expect(screen.getByTestId('guild-mine')).toBeTruthy();
      }
    });

    it('lets the open tab fill the screen below the tabs, from the top, whichever tab is open', async () => {
      await renderGuild();
      await screen.findByText('Cerco ao Grimório');
      const grows = (id: string) => expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({ flexGrow: 1 });

      grows('guild-content');
      grows('guild-layout-tabs');
      expect(StyleSheet.flatten(screen.getByTestId('guild-scroll').props.contentContainerStyle)).toMatchObject({ justifyContent: 'flex-start' });
      for (const tab of ['raid', 'mural', 'members', 'history'] as const) {
        await openTab(tab);
        grows('guild-tab-content');
      }
    });

    it('keeps the Raid ranking and the rewards with the Raid tab on a phone', async () => {
      mockedRanking.mockResolvedValue({ items: [], nextCursor: null });
      await renderGuild();
      expect(await screen.findByTestId('guild-ranking')).toBeTruthy();
      expect(await screen.findByTestId('guild-rewards')).toBeTruthy();
      await openTab('mural');
      expect(screen.queryByTestId('guild-ranking')).toBeNull();
      expect(screen.queryByTestId('guild-rewards')).toBeNull();
    });

    it('uses two columns on desktop with no tabs: Raid, ranking and history on the left, Mural and members on the right', async () => {
      Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
      await renderGuild();
      await screen.findByText('Cerco ao Grimório');

      expect(screen.queryByTestId('guild-tabs')).toBeNull();
      expect(within(screen.getByTestId('guild-header')).getByTestId('guild-mine')).toBeTruthy();
      expect(within(screen.getByTestId('guild-header')).getByTestId('guild-leave-section')).toBeTruthy();
      const main = screen.getByTestId('guild-column-main');
      const side = screen.getByTestId('guild-column-side');
      expect(within(main).getByTestId('guild-raid')).toBeTruthy();
      expect(within(main).getByTestId('guild-ranking')).toBeTruthy();
      expect(within(main).getByTestId('guild-past-raids')).toBeTruthy();
      expect(within(side).getByTestId('guild-mural')).toBeTruthy();
      expect(within(side).getByTestId('guild-members')).toBeTruthy();
      expect(within(side).getByTestId('guild-rewards')).toBeTruthy();
      expect(within(side).queryByTestId('guild-raid')).toBeNull();
    });

    it('keeps the touch targets at 44×44 px', async () => {
      await renderGuild();
      const leave = StyleSheet.flatten((await screen.findByTestId('guild-leave')).props.style);
      expect(leave).toMatchObject({ minWidth: 44, minHeight: 44 });
    });
  });
});

describe('Ranking interno', () => {
  const row = (position: number, name: string, contributionXp: number, overrides: Partial<RaidRankingEntry> = {}): RaidRankingEntry => ({
    position, userId: `u-${name}`, displayName: name, level: 3, title: null, avatar: null, accessory: null, contributionXp, isMe: false, ...overrides,
  });
  const rankingPage = (items: RaidRankingEntry[], nextCursor: string | null = null): RaidRankingPage => ({ items, nextCursor });

  beforeEach(() => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
  });

  it('shows position, name, level, Título and Contribution in focus hours, zero rows last', async () => {
    mockedRanking.mockResolvedValue(rankingPage([
      row(1, 'Bruno', 14_520, { title: 'Aprendiz', level: 4 }),
      row(2, 'Ana', 14_520),
      row(3, 'Dani', 0),
    ]));
    await renderGuild();

    const first = await screen.findByTestId('guild-ranking-item-u-Bruno');
    expect(within(first).getByText('1º')).toBeTruthy();
    expect(within(first).getByText('Nv 4 · Aprendiz')).toBeTruthy();
    expect(within(first).getByText('24,2h')).toBeTruthy();
    expect(within(screen.getByTestId('guild-ranking-item-u-Dani')).getByText('0,0h')).toBeTruthy();
    expect(mockedRanking).toHaveBeenCalledWith('r1', expect.objectContaining({ cursor: null }));
  });

  it('highlights the own row with a border and a label, not only with color', async () => {
    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 6_000), row(2, 'Ana', 1_200, { isMe: true, title: 'Aprendiz' })]));
    await renderGuild();

    const mineRow = await screen.findByTestId('guild-ranking-item-u-Ana');
    expect(within(mineRow).getByText('Você')).toBeTruthy();
    expect(mineRow.props.accessibilityLabel).toBe('Posição 2: Ana (você), nível 3, Aprendiz, 2,0h de foco');
    expect(screen.getByTestId('guild-ranking-item-u-Bruno').props.accessibilityLabel).toBe('Posição 1: Bruno, nível 3, 10,0h de foco');
    expect(StyleSheet.flatten(mineRow.props.style).borderColor).not.toBe('transparent');
    expect(StyleSheet.flatten(screen.getByTestId('guild-ranking-item-u-Bruno').props.style).borderColor).toBe('transparent');
  });

  it('names the own row on the desktop and shows five rows with no "Carregar mais"', async () => {
    Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
    mockedRanking.mockResolvedValue(rankingPage(
      ['Ana', 'Bruno', 'Carla', 'Dani', 'Eva', 'Fábio'].map((name, index) => row(index + 1, name, 6_000 - index * 600, { isMe: name === 'Dani' })),
      'next',
    ));
    await renderGuild();

    await screen.findByTestId('guild-ranking-item-u-Eva');
    expect(within(screen.getByTestId('guild-ranking-item-u-Dani')).getByText('Dani (você)')).toBeTruthy();
    expect(screen.queryByTestId('guild-ranking-item-u-Fábio')).toBeNull();
    expect(screen.queryByTestId('guild-ranking-more')).toBeNull();
  });

  it('shows four rows on a phone', async () => {
    mockedRanking.mockResolvedValue(rankingPage(['Ana', 'Bruno', 'Carla', 'Dani', 'Eva'].map((name, index) => row(index + 1, name, 6_000 - index * 600))));
    await renderGuild();

    await screen.findByTestId('guild-ranking-item-u-Dani');
    expect(screen.queryByTestId('guild-ranking-item-u-Eva')).toBeNull();
  });

  it('links "Ver todos", with no participant count, to the battle screen', async () => {
    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 300)]));
    await renderGuild();

    const link = await screen.findByTestId('guild-ranking-all');
    expect(within(link).getByText('Ver todos')).toBeTruthy();
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.href).toBe('/guilda/raid');
    expect(link.props.accessibilityLabel).toBe('Ver todos os participantes do Ranking interno');
    expect(screen.queryByText(/participantes/)).toBeNull();
  });

  it('shows the own place in the Raid block for a Participante', async () => {
    mockedRaid.mockResolvedValue(raid({ me: { participating: true, contributionXp: 120, position: 2 } }));
    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 300), row(2, 'Ana', 120, { isMe: true })]));
    await renderGuild();

    expect(await screen.findByTestId('guild-raid-my-contribution')).toHaveTextContent('0,2h · 2º lugar');
  });

  it('invites to participate when nobody has confirmed yet', async () => {
    await renderGuild();

    expect(await screen.findByTestId('guild-ranking-empty')).toBeTruthy();
  });

  it('shows a retryable error without hiding the Raid', async () => {
    mockedRanking.mockRejectedValueOnce(new ApiError('server', { status: 500 }));
    await renderGuild();

    expect(await screen.findByTestId('guild-ranking-error')).toBeTruthy();
    expect(screen.getByTestId('guild-raid-boss-life')).toBeTruthy();

    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 300)]));
    await fireEvent.press(within(screen.getByTestId('guild-ranking-error')).getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('guild-ranking-item-u-Bruno')).toBeTruthy();
  });

  it('keeps the last ranking on screen and warns that it is outdated when a refresh fails', async () => {
    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 300)]));
    const view = await renderGuild();
    await screen.findByTestId('guild-ranking-item-u-Bruno');

    mockedRanking.mockRejectedValue(new ApiError('network', {}));
    await view.client.refetchQueries({ queryKey: ['guild', 'raid', 'g1', 'ranking', 'r1'] });

    expect(await screen.findByTestId('guild-ranking-stale')).toBeTruthy();
    expect(screen.getByTestId('guild-ranking-item-u-Bruno')).toBeTruthy();
    expect(screen.queryByTestId('guild-ranking-error')).toBeNull();
  });

  it('refreshes the ranking, but not the Raid, when the user confirms participation', async () => {
    mockedJoinRaid.mockResolvedValue(undefined);
    mockedRanking.mockResolvedValueOnce(rankingPage([row(1, 'Bruno', 300)]));
    await renderGuild();
    await screen.findByTestId('guild-ranking-item-u-Bruno');

    mockedRanking.mockResolvedValue(rankingPage([row(1, 'Bruno', 300), row(2, 'Ana', 0, { isMe: true })]));
    await fireEvent.press(await screen.findByTestId('guild-raid-join'));

    expect(await screen.findByTestId('guild-ranking-item-u-Ana')).toBeTruthy();
    expect(mockedRaid).toHaveBeenCalledTimes(1);
  });

  it('has no ranking while the Guild has no Raid', async () => {
    mockedRaid.mockResolvedValue(null);
    await renderGuild();

    expect(await screen.findByTestId('guild-raid-empty')).toBeTruthy();
    expect(screen.queryByTestId('guild-ranking')).toBeNull();
    expect(mockedRanking).not.toHaveBeenCalled();
  });
});

describe('Raids anteriores', () => {
  const past = (id: string, overrides: Partial<PastRaid> = {}): PastRaid => ({
    id,
    mission: { slug: 'cerco-ao-grimorio', name: 'Cerco ao Grimório' },
    startsAt: '2026-10-05T03:00:00.000Z',
    endsAt: '2026-10-12T02:59:59.000Z',
    status: 'completed',
    goalXp: 1000,
    progressXp: 1250,
    me: { participated: true, contributionXp: 5640, position: 2 },
    ...overrides,
  });

  beforeEach(() => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
  });

  it('shows Missão, week, outcome and the own result of each closed Raid', async () => {
    mockedPast.mockResolvedValue({
      items: [
        past('p1'),
        past('p2', { mission: { slug: 'vigilia-da-aurora', name: 'Vigília da Aurora' }, status: 'expired', progressXp: 200, startsAt: '2026-09-28T03:00:00.000Z', endsAt: '2026-10-05T02:59:59.000Z', me: { participated: false, contributionXp: 0, position: null } }),
      ],
      nextCursor: null,
    });
    await renderGuild();
    await openTab('history');

    const won = await screen.findByTestId('guild-past-raid-p1');
    expect(within(won).getByText('Cerco ao Grimório')).toBeTruthy();
    expect(within(won).getByText('05–11 OUT · 1,6h')).toBeTruthy();
    expect(screen.getByTestId('guild-past-raid-outcome-p1')).toHaveTextContent('VENCIDA');
    expect(won.props.accessibilityLabel).toBe('Cerco ao Grimório. Semana de 05/10 a 11/10. Meta batida · a guilda subiu de nível. 1,6h. Você: 9,4h · 2º.');
    // The phone frame has no own-result line; it stays in the accessible label.
    expect(screen.queryByTestId('guild-past-raid-mine-p1')).toBeNull();
    expect(screen.getByTestId('guild-past-raids-won')).toHaveTextContent('1 vencida');

    const lost = screen.getByTestId('guild-past-raid-p2');
    expect(within(lost).getByText('28 SET–04 OUT · 0,3h de 1,6h')).toBeTruthy();
    expect(screen.getByTestId('guild-past-raid-outcome-p2')).toHaveTextContent('NÃO VENCIDA');
    expect(mockedPast).toHaveBeenCalledWith('g1', expect.objectContaining({ cursor: null }));
  });

  it('shows the own result and the Guild Level on each row of the desktop column', async () => {
    Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
    mockedPast.mockResolvedValue({ items: [past('p1'), past('p2', { status: 'expired', me: { participated: false, contributionXp: 0, position: null } })], nextCursor: null });
    await renderGuild();

    expect(await screen.findByTestId('guild-past-raid-mine-p1')).toHaveTextContent('Você: 9,4h · 2º');
    expect(screen.getByTestId('guild-past-raid-mine-p2')).toHaveTextContent('Você não participou');
    expect(screen.getByTestId('guild-past-raids-won')).toHaveTextContent('Nível 2 · 1 vencida');
  });

  it('explains when no Raid has closed yet', async () => {
    await renderGuild();
    await openTab('history');

    expect(await screen.findByTestId('guild-past-raids-empty')).toBeTruthy();
  });

  it('shows a retryable error without hiding the rest of the Guild', async () => {
    mockedPast.mockRejectedValueOnce(new ApiError('server', { status: 500 }));
    await renderGuild();
    await openTab('history');

    expect(await screen.findByTestId('guild-past-raids-error')).toBeTruthy();
    expect(screen.getByTestId('guild-mine')).toBeTruthy();

    mockedPast.mockResolvedValue({ items: [past('p1')], nextCursor: null });
    await fireEvent.press(within(screen.getByTestId('guild-past-raids-error')).getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('guild-past-raid-p1')).toBeTruthy();
  });

  it('loads older Raids with the cursor', async () => {
    mockedPast.mockResolvedValueOnce({ items: [past('p1')], nextCursor: 'older' });
    await renderGuild();
    await openTab('history');
    await screen.findByTestId('guild-past-raid-p1');

    mockedPast.mockResolvedValueOnce({ items: [past('p0', { startsAt: '2026-09-28T03:00:00.000Z' })], nextCursor: null });
    await fireEvent.press(screen.getByTestId('guild-past-raids-more'));

    expect(await screen.findByTestId('guild-past-raid-p0')).toBeTruthy();
    expect(mockedPast).toHaveBeenLastCalledWith('g1', expect.objectContaining({ cursor: 'older' }));
    expect(screen.queryByTestId('guild-past-raids-more')).toBeNull();
  });
});
