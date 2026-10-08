import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getMyGuild, joinGuild, listGuilds } from '@/features/guild/api';
import { formatGuildRole, formatMemberCount } from '@/features/guild/messages';
import { validateGuildName } from '@/features/guild/validation';

jest.mock('@/core/api/api-client', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const client = (methods: Record<string, jest.Mock>) => (getAuthenticatedHttpClient as jest.Mock).mockReturnValue(methods);

describe('guild API', () => {
  it('returns the user guild and forwards the abort signal', async () => {
    const mine = { guild: { id: 'g1', name: 'Ordem', level: 1, memberCount: 2 }, role: 'leader' };
    const get = jest.fn().mockResolvedValue({ status: 200, data: mine });
    client({ get });
    const signal = new AbortController().signal;

    await expect(getMyGuild({ signal })).resolves.toEqual(mine);
    expect(get).toHaveBeenCalledWith('/guilds/me', { signal });
  });

  it('treats 404 as "no guild" but propagates every other failure', async () => {
    client({ get: jest.fn().mockRejectedValue(new ApiError('unexpected', { status: 404 })) });
    await expect(getMyGuild()).resolves.toBeNull();

    const failure = new ApiError('server', { status: 500 });
    client({ get: jest.fn().mockRejectedValue(failure) });
    await expect(getMyGuild()).rejects.toBe(failure);
  });

  it('builds the directory query from the search term and cursor', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    client({ get });

    await listGuilds();
    await listGuilds({ search: 'foco total', cursor: 'abc' });

    expect(get).toHaveBeenNthCalledWith(1, '/guilds', { signal: undefined });
    expect(get).toHaveBeenNthCalledWith(2, '/guilds?search=foco+total&cursor=abc', { signal: undefined });
  });

  it('creates and joins guilds', async () => {
    const post = jest.fn().mockResolvedValue({ status: 204, data: undefined });
    client({ post });

    await createGuild('Ordem do Foco');
    await joinGuild('guild 1');

    expect(post).toHaveBeenNthCalledWith(1, '/guilds', { name: 'Ordem do Foco' });
    expect(post).toHaveBeenNthCalledWith(2, '/guilds/guild%201/members');
  });
});

describe('guild helpers', () => {
  it('validates the name like the API does', () => {
    expect(validateGuildName('   ')).toBe('Dê um nome à sua guilda.');
    expect(validateGuildName(' ab ')).toMatch(/ao menos 3/);
    expect(validateGuildName('a'.repeat(61))).toMatch(/no máximo 60/);
    expect(validateGuildName('  Ordem  ')).toBeUndefined();
  });

  it('formats counts and roles in Portuguese', () => {
    expect(formatMemberCount(1)).toBe('1 membro');
    expect(formatMemberCount(3)).toBe('3 membros');
    expect(formatGuildRole('leader')).toBe('Líder');
    expect(formatGuildRole('member')).toBe('Membro');
  });
});
