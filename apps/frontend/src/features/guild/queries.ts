import { infiniteQueryOptions, keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { getActiveRaid, getMyGuild, getNextMission, listAvailableMissions, getRaidRanking, listGuildMembers, listGuilds, listPastRaids } from './api';

export const guildKeys = {
  all: ['guild'] as const,
  mine: () => ['guild', 'mine'] as const,
  directory: (search: string) => ['guild', 'directory', search] as const,
  members: (guildId: string) => ['guild', 'members', guildId] as const,
  raids: () => ['guild', 'raid'] as const,
  raid: (guildId: string) => ['guild', 'raid', guildId] as const,
  // Nested under the Raid key: invalidating the Raid (as the Forja does after a guild session) refreshes the ranking too.
  raidRanking: (guildId: string, raidId: string) => ['guild', 'raid', guildId, 'ranking', raidId] as const,
  nextMission: (guildId: string) => ['guild', 'next-mission', guildId] as const,
  availableMissions: (guildId: string) => ['guild', 'next-mission', guildId, 'available'] as const,
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
  // Keeps the last list on screen while a new search loads, so typing does not flash the loading state.
  placeholderData: keepPreviousData,
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

/** The active Raid of a Guild that may not be known yet: it stays idle (pending) until there is a `guildId`. */
export function useActiveRaid(guildId: string | undefined) {
  return useQuery({ ...activeRaidQueryOptions(guildId ?? ''), enabled: guildId !== undefined });
}

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

export const nextMissionQueryOptions = (guildId: string) => queryOptions({
  queryKey: guildKeys.nextMission(guildId),
  queryFn: ({ signal }) => getNextMission(guildId, { signal }),
  staleTime: 30_000,
  retry: false,
});

export const availableMissionsQueryOptions = (guildId: string) => queryOptions({
  queryKey: guildKeys.availableMissions(guildId),
  queryFn: ({ signal }) => listAvailableMissions(guildId, { signal }),
  // The owners follow the members and what they buy: always fresh when the drawer opens.
  staleTime: 0,
  retry: false,
});
