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

/** Progress and target of one Objetivo, as the Dashboard and the Forja show them. */
export type ObjectiveProgress = { progress: number; target: number };
export type SessionsObjective = ObjectiveProgress;
export type WeeklyMinutesObjective = ObjectiveProgress;

function progressOf(objective: ObjectiveProgress | undefined): ObjectiveProgress | undefined {
  return objective && { progress: objective.progress, target: objective.target };
}

/** Shares the Crônicas query, so a change on the server reaches the Dashboard and Crônicas together. */
export function useSessionsObjective(): SessionsObjective | undefined {
  const { data } = useQuery(objectivesQueryOptions());
  return progressOf(data?.daily.items.find(({ id }) => id === SESSIONS_OBJECTIVE_ID));
}

/** The weekly Objetivo counted in valid focus minutes. The server configures the weekly ids, so the unit is the contract; with several, the first in the server's order wins. */
export function useWeeklyMinutesObjective(): WeeklyMinutesObjective | undefined {
  const { data } = useQuery(objectivesQueryOptions());
  return progressOf(data?.weekly.items.find(({ unit }) => unit === 'minutes'));
}
