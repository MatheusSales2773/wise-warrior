import { useQuery } from '@tanstack/react-query';
import { getActiveStudySession, getRecentStudySessionSubjects } from './api';

export const activeStudySessionQueryKey = ['study-session', 'active'] as const;

export const recentStudySessionSubjectsQueryKey = ['study-session', 'recent-subjects'] as const;

export function useActiveStudySession() {
  return useQuery({
    queryKey: activeStudySessionQueryKey,
    queryFn: ({ signal }) => getActiveStudySession(signal),
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
