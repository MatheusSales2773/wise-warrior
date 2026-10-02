import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getMyGuild, joinGuild, leaveGuild, listGuildMembers, listGuilds, type GuildMemberPage, type GuildPage, type MyGuild } from '@/features/guild/api';
import { GuildScreen } from '@/features/guild/guild-screen';

jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  listGuilds: jest.fn(),
  createGuild: jest.fn(),
  joinGuild: jest.fn(),
  listGuildMembers: jest.fn(),
  leaveGuild: jest.fn(),
}));

const mockedMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const mockedList = listGuilds as jest.MockedFunction<typeof listGuilds>;
const mockedCreate = createGuild as jest.MockedFunction<typeof createGuild>;
const mockedJoin = joinGuild as jest.MockedFunction<typeof joinGuild>;
const mockedMembers = listGuildMembers as jest.MockedFunction<typeof listGuildMembers>;
const mockedLeave = leaveGuild as jest.MockedFunction<typeof leaveGuild>;

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
  return render(<QueryClientProvider client={client}><GuildScreen /></QueryClientProvider>);
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
});
afterEach(() => { jest.clearAllMocks(); [mockedMine, mockedList, mockedCreate, mockedJoin, mockedMembers, mockedLeave].forEach((mock) => mock.mockReset()); });

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
});
