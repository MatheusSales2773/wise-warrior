import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getMyGuild, joinGuild, listGuilds, type GuildPage, type MyGuild } from '@/features/guild/api';
import { GuildScreen } from '@/features/guild/guild-screen';

jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  listGuilds: jest.fn(),
  createGuild: jest.fn(),
  joinGuild: jest.fn(),
}));

const mockedMine = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const mockedList = listGuilds as jest.MockedFunction<typeof listGuilds>;
const mockedCreate = createGuild as jest.MockedFunction<typeof createGuild>;
const mockedJoin = joinGuild as jest.MockedFunction<typeof joinGuild>;

const mine: MyGuild = { guild: { id: 'g1', name: 'Ordem do Foco', level: 2, memberCount: 3 }, role: 'leader' };
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
afterEach(() => { jest.clearAllMocks(); [mockedMine, mockedList, mockedCreate, mockedJoin].forEach((mock) => mock.mockReset()); });

describe('GuildScreen', () => {
  it('shows the guild of a member with level, size and role', async () => {
    mockedMine.mockResolvedValue(mine);
    await renderGuild();

    expect((await screen.findByTestId('guild-mine-name')).props.children).toBe('Ordem do Foco');
    expect(screen.getByText('Nível 2')).toBeTruthy();
    expect(screen.getByText('3 membros')).toBeTruthy();
    expect(screen.getByText('LÍDER')).toBeTruthy();
    expect(screen.queryByTestId('guild-create')).toBeNull();
    expect(mockedList).not.toHaveBeenCalled();
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
    await renderGuild();

    expect(await screen.findByTestId('guild-error')).toBeTruthy();
    mockedMine.mockResolvedValue(mine);
    await fireEvent.press(screen.getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('guild-mine')).toBeTruthy();
  });
});
