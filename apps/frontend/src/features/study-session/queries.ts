import { useQuery, type QueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '@/features/dashboard/queries';
import { guildKeys } from '@/features/guild/queries';
import {
  getActiveStudySession,
  getFocusCycle,
  getRecentStudySessionSubjects,
  type StudySessionSnapshot,
  type StudySessionTransitionResult,
} from './api';
import { retainServerCompletion } from './completion-intent';

export const activeStudySessionQueryKey = ['study-session', 'active'] as const;

export const recentStudySessionSubjectsQueryKey = ['study-session', 'recent-subjects'] as const;

export function useActiveStudySession() {
  return useQuery({
    queryKey: activeStudySessionQueryKey,
    queryFn: async ({ signal }) => {
      const snapshot = await getActiveStudySession(signal);
      if (!snapshot || snapshot.state === 'running' || snapshot.state === 'paused') return snapshot;
      // A terminal snapshot is the result of the expired focus that this read completed: no session is active.
      retainServerCompletion(snapshot as StudySessionTransitionResult);
      return null;
    },
    staleTime: 0,
    retry: false,
  });
}

/** Suggestions never gate the start: callers treat loading, failure and emptiness alike. */
export function useRecentStudySessionSubjects() {
  return useQuery({
    queryKey: recentStudySessionSubjectsQueryKey,
    queryFn: ({ signal }) => getRecentStudySessionSubjects(signal),
    retry: false,
  });
}

export const focusCycleQueryKey = ['study-session', 'cycle'] as const;

/**
 * Everything a terminal Study Session changes besides the active snapshot. `mode` is `null` when the device
 * does not know the ended session (for example, another device ended it while this cache was empty).
 */
export function invalidateStudySessionResult(
  queryClient: QueryClient,
  mode: StudySessionSnapshot['mode'] | null,
): Promise<unknown[]> {
  return Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: dashboardKeys.profile() }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.recentActivity() }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.metrics() }),
    // Every day of the history: the session lands in its São Paulo day, whatever day the screen shows.
    queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'history'] }),
    queryClient.invalidateQueries({ queryKey: focusCycleQueryKey }),
    // A guild-mode session may have become a Contribution; null means the mode is unknown, so refresh too.
    ...(mode === 'solo' ? [] : [queryClient.invalidateQueries({ queryKey: [...guildKeys.all, 'raid'] })]),
  ]);
}

/** The break offer degrades to the short break when this is loading or failed, so it never gates anything. */
export function useFocusCycle() {
  return useQuery({
    queryKey: focusCycleQueryKey,
    queryFn: ({ signal }) => getFocusCycle(signal),
    retry: false,
  });
}
