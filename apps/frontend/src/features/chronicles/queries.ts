import { queryOptions, useQuery } from '@tanstack/react-query';
import { getMilestones, getObjectives } from './api';

export const chroniclesKeys = {
  all: ['chronicles'] as const,
  objectives: () => [...chroniclesKeys.all, 'objectives'] as const,
  milestones: () => [...chroniclesKeys.all, 'milestones'] as const,
};

export const objectivesQueryOptions = () => queryOptions({
  queryKey: chroniclesKeys.objectives(),
  queryFn: ({ signal }) => getObjectives({ signal }),
  staleTime: 30_000,
  retry: false,
});

export const milestonesQueryOptions = () => queryOptions({
  queryKey: chroniclesKeys.milestones(),
  queryFn: ({ signal }) => getMilestones({ signal }),
  staleTime: 30_000,
  retry: false,
});

/** The daily Objetivo that counts finished sessions; the Dashboard shows its progress and target. Its id is part of the contract (`docs/api/openapi.yaml`, pinned by `daily-objectives.spec.ts`). */
export const SESSIONS_OBJECTIVE_ID = 'four-sessions';

export type SessionsObjective = { progress: number; target: number };

/** Shares the Crônicas query, so a change on the server reaches the Dashboard and Crônicas together. */
export function useSessionsObjective(): SessionsObjective | undefined {
  const { data } = useQuery(objectivesQueryOptions());
  const objective = data?.daily.items.find(({ id }) => id === SESSIONS_OBJECTIVE_ID);
  return objective && { progress: objective.progress, target: objective.target };
}

export type WeeklyMinutesObjective = { progress: number; target: number };

/** The weekly Objetivo that counts valid focus minutes, when the server lists one. */
export function useWeeklyMinutesObjective(): WeeklyMinutesObjective | undefined {
  const { data } = useQuery(objectivesQueryOptions());
  const objective = data?.weekly.items.find(({ unit }) => unit === 'minutes');
  return objective && { progress: objective.progress, target: objective.target };
}
