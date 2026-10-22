import { useEffect } from 'react';
import { useBreakRun } from './pomodoro-break';
import type { StudySessionSnapshot } from './api';
import { useActiveStudySession } from './queries';
import { releaseSessionSounds } from './sounds';
import { useDeadlineAlarm } from './use-deadline-alarm';

/** Local instant a running focus ends, by the server clock offset the snapshot was received with. */
function focusEndsAtMs(snapshot: StudySessionSnapshot | null | undefined): number | null {
  if (!snapshot || snapshot.state !== 'running' || !snapshot.runDeadlineAt) return null;
  const clockOffset = new Date(snapshot.serverNow).getTime() - snapshot.receivedAtMs;
  return new Date(snapshot.runDeadlineAt).getTime() - clockOffset;
}

/**
 * The end-of-focus and end-of-break alarm lives in the app layout, like the heartbeat: it keeps ringing
 * when the Forja is not on screen or the tab is hidden.
 */
export function StudySessionSoundRuntime() {
  const active = useActiveStudySession();
  const breakRun = useBreakRun();
  useDeadlineAlarm({ key: active.data?.id ?? null, atMs: focusEndsAtMs(active.data), sound: 'focusEnd' });
  useDeadlineAlarm({ key: breakRun ? 'break' : null, atMs: breakRun?.deadlineMs ?? null, sound: 'breakEnd' });
  useEffect(() => releaseSessionSounds, []);
  return null;
}
