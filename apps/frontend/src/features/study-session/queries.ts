import { useQuery } from '@tanstack/react-query';
import { getActiveStudySession } from './api';

export const activeStudySessionQueryKey = ['study-session', 'active'] as const;

export function useActiveStudySession() {
  return useQuery({
    queryKey: activeStudySessionQueryKey,
    queryFn: ({ signal }) => getActiveStudySession(signal),
    staleTime: 0,
    retry: false,
  });
}
