import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getMyGuild, listGuilds } from './api';

export const guildKeys = {
  all: ['guild'] as const,
  mine: () => ['guild', 'mine'] as const,
  directory: (search: string) => ['guild', 'directory', search] as const,
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
