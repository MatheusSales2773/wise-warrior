import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getMyGuild, listGuildMembers, listGuilds } from './api';

export const guildKeys = {
  all: ['guild'] as const,
  mine: () => ['guild', 'mine'] as const,
  directory: (search: string) => ['guild', 'directory', search] as const,
  members: (guildId: string) => ['guild', 'members', guildId] as const,
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
