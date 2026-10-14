import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getActiveRaid, getMyGuild, getRaidRanking, listGuildMembers, listGuilds, listPastRaids } from './api';

export const guildKeys = {
  all: ['guild'] as const,
  mine: () => ['guild', 'mine'] as const,
  directory: (search: string) => ['guild', 'directory', search] as const,
  members: (guildId: string) => ['guild', 'members', guildId] as const,
  raid: (guildId: string) => ['guild', 'raid', guildId] as const,
  // Nested under the Raid key: invalidating the Raid (as the Forja does after a guild session) refreshes the ranking too.
  raidRanking: (guildId: string, raidId: string) => ['guild', 'raid', guildId, 'ranking', raidId] as const,
  pastRaids: (guildId: string) => ['guild', 'raid', guildId, 'past'] as const,
};

export const myGuildQueryOptions = () => queryOptions({
  queryKey: guildKeys.mine(),
  queryFn: ({ signal }) => getMyGuild({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const guildDirectoryQueryOptions = (search: string) => infiniteQueryOptions({
  queryKey: guildKeys.directory(search),
  queryFn: ({ pageParam, signal }) => listGuilds({ search, cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 30_000,
  retry: false,
});

export const guildMembersQueryOptions = (guildId: string) => infiniteQueryOptions({
  queryKey: guildKeys.members(guildId),
  queryFn: ({ pageParam, signal }) => listGuildMembers(guildId, { cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 30_000,
  retry: false,
});

export const activeRaidQueryOptions = (guildId: string) => queryOptions({
  queryKey: guildKeys.raid(guildId),
  queryFn: ({ signal }) => getActiveRaid(guildId, { signal }),
  staleTime: 30_000,
  retry: false,
});

export const raidRankingQueryOptions = (guildId: string, raidId: string) => infiniteQueryOptions({
  queryKey: guildKeys.raidRanking(guildId, raidId),
  queryFn: ({ pageParam, signal }) => getRaidRanking(raidId, { cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 30_000,
  retry: false,
});

export const pastRaidsQueryOptions = (guildId: string) => infiniteQueryOptions({
  queryKey: guildKeys.pastRaids(guildId),
  queryFn: ({ pageParam, signal }) => listPastRaids(guildId, { cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: 60_000,
  retry: false,
});
