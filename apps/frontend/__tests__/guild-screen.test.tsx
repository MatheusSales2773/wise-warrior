import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getActiveRaid, getMyGuild, joinGuild, joinRaid, leaveGuild, listGuildMembers, listGuilds, type ActiveRaid, type GuildMemberPage, type GuildPage, type MyGuild } from '@/features/guild/api';
import { GuildScreen } from '@/features/guild/guild-screen';

jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
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

const DAY = 24 * 60 * 60 * 1000;
const raid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'r1',
  mission: { slug: 'cerco-ao-grimorio', name: 'Cerco ao Grimório', description: 'Cerque os capítulos mais difíceis.', imageUrl: null },
  reward: { itemId: 'i1', name: 'Marcador do Grimório', category: 'badge' },
  goalXp: 1000,
  progressXp: 250,
  startsAt: new Date(Date.now() - 2 * DAY).toISOString(),
  endsAt: new Date(Date.now() + 2 * DAY + 3.5 * 60 * 60 * 1000).toISOString(),
  status: 'active',
  me: { participating: false },
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

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  Dimensions.set({ window: { width: 390, height: 844, scale: 1, fontScale: 1 } });
  mockedRaid.mockResolvedValue(raid());
});
afterEach(() => { jest.clearAllMocks(); [mockedRaid, mockedMine, mockedList, mockedCreate, mockedJoin, mockedMembers, mockedLeave, mockedJoinRaid].forEach((mock) => mock.mockReset()); });

describe('GuildScreen', () => {
  it('shows the guild of a member with level, size and role', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValue(members(['Ana']));
    await renderGuild();

    expect((await screen.findByTestId('guild-mine-name')).props.children).toBe('Ordem do Foco');
    expect(screen.getByText('Nível 2')).toBeTruthy();
    expect(screen.getByText('3 membros')).toBeTruthy();
    expect(screen.getAllByText('LÍDER').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('guild-create')).toBeNull();
    expect(mockedList).not.toHaveBeenCalled();
    expect(screen.getByTestId('guild-mine-leader').props.children).toEqual(['Líder: ', 'Ana']);
  });

  it('lists the members with level and title and loads further pages', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockResolvedValueOnce(members(['Ana', 'Bruno'], 'next'));
    await renderGuild();

    expect(await screen.findByTestId('guild-member-u-Ana')).toBeTruthy();
    expect(screen.getByText('Nível 2 · Aprendiz')).toBeTruthy();
    expect(screen.getByTestId('guild-member-u-Bruno')).toBeTruthy();

    mockedMembers.mockResolvedValueOnce({ items: [{ ...members(['Carla']).items[0]!, role: 'member' }], nextCursor: null });
    await fireEvent.press(screen.getByTestId('guild-members-more'));
    expect(await screen.findByTestId('guild-member-u-Carla')).toBeTruthy();
    expect(mockedMembers).toHaveBeenLastCalledWith('g1', expect.objectContaining({ cursor: 'next' }));
  });

  it('keeps the guild visible when the members cannot be loaded', async () => {
    mockedMine.mockResolvedValue(mine);
    mockedMembers.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderGuild();

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
    expect(await screen.findByTestId('guild-create')).toBeTruthy();
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

  it('offers to create or find a guild when the user has none', async () => {
    mockedMine.mockResolvedValue(null);
    mockedList.mockResolvedValue(page(['Alfa', 'Beta']));
    await renderGuild();

    expect(await screen.findByTestId('guild-create')).toBeTruthy();
    expect(await screen.findByTestId('guild-directory-item-id-Alfa')).toBeTruthy();
    expect(screen.getByTestId('guild-directory-item-id-Beta')).toBeTruthy();
  });

  it('validates the name before calling the API, then creates and shows the new guild', async () => {
    mockedMine.mockResolvedValueOnce(null);
    mockedList.mockResolvedValue(page([]));
    mockedMembers.mockResolvedValue(members(['Ana']));
    mockedCreate.mockResolvedValue(undefined);
    await renderGuild();
    await screen.findByTestId('guild-create');

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
    await screen.findByTestId('guild-create');

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
    await fireEvent.press(screen.getByTestId('guild-directory-search-submit'));
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

    it('shows the Missão, the collective goal with an accessible progress bar, the time left and the reward', async () => {
      await renderGuild();

      expect(await screen.findByText('Cerco ao Grimório')).toBeTruthy();
      expect(screen.getByText('Cerque os capítulos mais difíceis.')).toBeTruthy();
      expect(mockedRaid).toHaveBeenCalledWith('g1', expect.anything());

      const bar = screen.getByTestId('guild-raid-progress');
      expect(bar.props.accessibilityRole).toBe('progressbar');
      expect(bar.props.accessibilityLabel).toBe('Progresso da Raid: 250 de 1000 XP, 25%');
      expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 1000, now: 250 });
      expect(screen.getByText('250 / 1000 XP')).toBeTruthy();
      expect(screen.getByTestId('guild-raid-time-left').props.children).toBe('2 d 3 h restantes');
      expect(screen.getByText('Marcador do Grimório')).toBeTruthy();
      expect(screen.getByText(/Badge/)).toBeTruthy();
      expect(screen.getByText(/contribua com ao menos uma sessão de guilda/)).toBeTruthy();
    });

    describe('participation', () => {
      it('offers "Participar" and, once confirmed, shows "Você está nesta Raid" without a refetch', async () => {
        mockedJoinRaid.mockResolvedValue(undefined);
        await renderGuild();

        fireEvent.press(await screen.findByTestId('guild-raid-join'));

        expect(await screen.findByTestId('guild-raid-participating')).toBeTruthy();
        expect(screen.getByText('Você está nesta Raid')).toBeTruthy();
        expect(screen.queryByTestId('guild-raid-join')).toBeNull();
        expect(mockedJoinRaid).toHaveBeenCalledTimes(1);
        expect(mockedJoinRaid).toHaveBeenCalledWith('r1');
        expect(mockedRaid).toHaveBeenCalledTimes(1);
      });

      it('shows "Você está nesta Raid" straight away for a Participante, with no button', async () => {
        mockedRaid.mockResolvedValue(raid({ me: { participating: true } }));
        await renderGuild();

        expect(await screen.findByTestId('guild-raid-participating')).toBeTruthy();
        expect(screen.queryByTestId('guild-raid-join')).toBeNull();
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
        expect(await screen.findByTestId('guild-raid-participating')).toBeTruthy();
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

        expect(await screen.findByTestId('guild-raid-participating')).toBeTruthy();
        expect(screen.queryByTestId('guild-raid-join-error')).toBeNull();
      });
    });

    it('reserves a decorative image slot that screen readers skip', async () => {
      await renderGuild();
      const image = await screen.findByTestId('guild-raid-image', { includeHiddenElements: true });
      expect(image.props['aria-hidden']).toBe(true);
      expect(image.props.accessibilityElementsHidden).toBe(true);
      expect(image.props.importantForAccessibility).toBe('no-hide-descendants');
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
      expect(screen.getByTestId('guild-members')).toBeTruthy();

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

    it('stacks everything on a phone: guild, Raid, members, then leave', async () => {
      await renderGuild();
      await screen.findByText('Cerco ao Grimório');
      expect(screen.getByTestId('guild-layout-stacked')).toBeTruthy();
      expect(screen.queryByTestId('guild-column-main')).toBeNull();
      const order = ['guild-mine', 'guild-raid', 'guild-members', 'guild-leave-section'];
      const tree = JSON.stringify(screen.toJSON());
      const positions = order.map((id) => tree.indexOf(`"testID":"${id}"`));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('uses two columns on desktop: guild and Raid on the left, members and leave on the right', async () => {
      Dimensions.set({ window: { width: 1280, height: 800, scale: 1, fontScale: 1 } });
      await renderGuild();
      await screen.findByText('Cerco ao Grimório');

      const main = screen.getByTestId('guild-column-main');
      const side = screen.getByTestId('guild-column-side');
      expect(within(main).getByTestId('guild-mine')).toBeTruthy();
      expect(within(main).getByTestId('guild-raid')).toBeTruthy();
      expect(within(side).getByTestId('guild-members')).toBeTruthy();
      expect(within(side).getByTestId('guild-leave-section')).toBeTruthy();
      expect(within(side).queryByTestId('guild-raid')).toBeNull();
    });

    it('keeps the touch targets at 44×44 px', async () => {
      await renderGuild();
      const leave = StyleSheet.flatten((await screen.findByTestId('guild-leave')).props.style);
      expect(leave).toMatchObject({ minWidth: 44, minHeight: 44 });
    });
  });
});
