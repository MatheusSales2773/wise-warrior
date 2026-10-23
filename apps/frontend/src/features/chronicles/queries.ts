import { queryOptions } from '@tanstack/react-query';
import { getObjectives } from './api';

export const chroniclesKeys = {
  all: ['chronicles'] as const,
  objectives: () => [...chroniclesKeys.all, 'objectives'] as const,
};

export const objectivesQueryOptions = () => queryOptions({
  queryKey: chroniclesKeys.objectives(),
  queryFn: ({ signal }) => getObjectives({ signal }),
  staleTime: 30_000,
  retry: false,
});
