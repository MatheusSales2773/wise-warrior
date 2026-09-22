import { useActiveStudySession } from './queries';
import { useStudySessionHeartbeat } from './use-study-session-heartbeat';

export function StudySessionHeartbeatRuntime() {
  const active = useActiveStudySession();
  useStudySessionHeartbeat(active.data ?? undefined);
  return null;
}
