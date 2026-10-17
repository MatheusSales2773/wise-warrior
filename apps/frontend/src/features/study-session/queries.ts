import { useQuery } from '@tanstack/react-query';
import { getActiveStudySession, getFocusCycle, getRecentStudySessionSubjects, type StudySessionTransitionResult } from './api';
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

/** The break offer degrades to the short break when this is loading or failed, so it never gates anything. */
export function useFocusCycle() {
  return useQuery({
    queryKey: focusCycleQueryKey,
    queryFn: ({ signal }) => getFocusCycle(signal),
    retry: false,
  });
}
