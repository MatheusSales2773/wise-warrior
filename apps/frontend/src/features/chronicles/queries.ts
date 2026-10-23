import { queryOptions, useQuery } from '@tanstack/react-query';
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

/** The daily Objetivo that counts finished sessions; the Dashboard shows its progress and target. */
export const SESSIONS_OBJECTIVE_ID = 'four-sessions';

export type SessionsObjective = { progress: number; target: number };

/** Shares the Crônicas query, so a change on the server reaches the Dashboard and Crônicas together. */
export function useSessionsObjective(): SessionsObjective | undefined {
  const { data } = useQuery(objectivesQueryOptions());
  const objective = data?.daily.items.find(({ id }) => id === SESSIONS_OBJECTIVE_ID);
  return objective && { progress: objective.progress, target: objective.target };
}
