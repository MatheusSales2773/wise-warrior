import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { ApiError } from '@/core/api/api-error';
import { createGuild, getActiveRaid, getMyGuild, getRaidRanking, joinGuild, leaveGuild, listGuildMembers, listGuilds, listPastRaids, joinRaid } from '@/features/guild/api';
import { formatGuildRole, formatMemberCount, formatMyPosition, formatPastRaidMine, formatPastRaidOutcome, formatPastRaidPeriod, formatPastRaidSeal, formatPastRaidTotals, formatRaidWeek, formatWonRaids } from '@/features/guild/messages';
import { rankingEntryLabel } from '@/features/guild/raid-battle';
import { validateGuildName } from '@/features/guild/validation';

jest.mock('@/core/api/api-client', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const client = (methods: Record<string, jest.Mock>) => (getAuthenticatedHttpClient as jest.Mock).mockReturnValue(methods);

describe('guild API', () => {
  it('confirms participation in a Raid and lets the failure through', async () => {
    const post = jest.fn().mockResolvedValue({ status: 204 });
    client({ post });
    await expect(joinRaid('r 1')).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/raids/r%201/join');

    const failure = new ApiError('conflict', { status: 409 });
    client({ post: jest.fn().mockRejectedValue(failure) });
    await expect(joinRaid('r1')).rejects.toBe(failure);
  });

  it('reads the active Raid of a Guild and treats 404 as "no Raid this week"', async () => {
    const raid = { id: 'r1', goalXp: 1000 };
    const get = jest.fn().mockResolvedValue({ status: 200, data: raid });
    client({ get });
    await expect(getActiveRaid('g 1')).resolves.toEqual(raid);
    expect(get).toHaveBeenCalledWith('/guilds/g%201/raids/active', { signal: undefined });

    client({ get: jest.fn().mockRejectedValue(new ApiError('unexpected', { status: 404 })) });
    await expect(getActiveRaid('g1')).resolves.toBeNull();

    const failure = new ApiError('server', { status: 500 });
    client({ get: jest.fn().mockRejectedValue(failure) });
    await expect(getActiveRaid('g1')).rejects.toBe(failure);
  });

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

describe('guild members API', () => {
  it('lists members with an encoded cursor and leaves through DELETE', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    const del = jest.fn().mockResolvedValue({ status: 204, data: undefined });
    client({ get, delete: del });

    await listGuildMembers('g 1');
    await listGuildMembers('g1', { cursor: 'a+b/c=' });
    await leaveGuild('g 1');

    expect(get).toHaveBeenNthCalledWith(1, '/guilds/g%201/members', { signal: undefined });
    expect(get).toHaveBeenNthCalledWith(2, '/guilds/g1/members?cursor=a%2Bb%2Fc%3D', { signal: undefined });
    expect(del).toHaveBeenCalledWith('/guilds/g%201/members/me');
  });
});

describe('raid ranking API', () => {
  it('requests the ranking of a Raid with an encoded cursor', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    client({ get });
    const signal = new AbortController().signal;

    await getRaidRanking('r 1', { signal });
    await getRaidRanking('r1', { cursor: 'a+b=' });

    expect(get).toHaveBeenNthCalledWith(1, '/raids/r%201/ranking', { signal });
    expect(get).toHaveBeenNthCalledWith(2, '/raids/r1/ranking?cursor=a%2Bb%3D', { signal: undefined });
  });
});

describe('past raids API', () => {
  it('lists the closed Raids of a Guild with an encoded cursor', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    client({ get });

    await listPastRaids('g 1');
    await listPastRaids('g1', { cursor: 'x/y=' });

    expect(get).toHaveBeenNthCalledWith(1, '/guilds/g%201/raids', { signal: undefined });
    expect(get).toHaveBeenNthCalledWith(2, '/guilds/g1/raids?cursor=x%2Fy%3D', { signal: undefined });
  });
});

describe('past raid helpers', () => {
  it('reads the week in São Paulo and describes the outcome and the own result', () => {
    // Monday 00:00 and Sunday 23:59:59 in São Paulo are 03:00 and 02:59:59 in UTC.
    expect(formatRaidWeek('2026-10-05T03:00:00.000Z', '2026-10-12T02:59:59.000Z')).toBe('Semana de 05/10 a 11/10');
    expect(formatPastRaidOutcome('completed')).toMatch(/Meta batida/);
    expect(formatPastRaidOutcome('expired')).toBe('Meta não batida');
    expect(formatPastRaidMine({ participated: false, contributionXp: 0, position: null })).toBe('Você não participou');
    expect(formatPastRaidMine({ participated: true, contributionXp: 5640, position: 3 })).toBe('Você: 9,4h · 3º');
    expect(formatPastRaidMine({ participated: true, contributionXp: 600, position: null })).toBe('Você: 1,0h');
    // The own result is rounded like the Raid totals, so it never reads above the goal.
    expect(formatPastRaidMine({ participated: true, contributionXp: 7620, position: 1 })).toBe('Você: 12h · 1º');
    expect(formatPastRaidTotals({ status: 'completed', goalXp: 7620, progressXp: 7700 })).toBe('12h');
    expect(formatPastRaidTotals({ status: 'expired', goalXp: 108000, progressXp: 84000 })).toBe('140h de 180h');
    expect(formatPastRaidSeal('completed')).toBe('VENCIDA');
    expect(formatPastRaidSeal('expired')).toBe('NÃO VENCIDA');
    expect(formatPastRaidPeriod('2026-10-05T03:00:00.000Z', '2026-10-12T02:59:59.000Z')).toBe('05–11 OUT');
    expect(formatPastRaidPeriod('2026-09-28T03:00:00.000Z', '2026-10-05T02:59:59.000Z')).toBe('28 SET–04 OUT');
    expect(formatWonRaids(1)).toBe('nenhuma vencida');
    expect(formatWonRaids(2)).toBe('1 vencida');
    expect(formatWonRaids(7)).toBe('6 vencidas');
  });
});

describe('ranking helpers', () => {
  it('describes the own place and each row for screen readers', () => {
    expect(formatMyPosition(null)).toBeNull();
    expect(formatMyPosition(3)).toBe('Sua posição: 3º no Ranking interno');
    expect(rankingEntryLabel({ position: 1, displayName: 'Ana', level: 5, title: null, contributionXp: 0, isMe: true })).toBe('Posição 1: Ana (você), nível 5, 0,0h de foco');
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
