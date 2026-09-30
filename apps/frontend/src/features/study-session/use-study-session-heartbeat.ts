import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { heartbeatStudySession, type StudySessionSnapshot } from './api';

export const STUDY_SESSION_HEARTBEAT_INTERVAL_MS = 60_000;

export function useStudySessionHeartbeat(snapshot: StudySessionSnapshot | undefined): void {
  const [appState, setAppState] = useState<AppStateStatus>(
    typeof AppState.currentState === 'string' ? AppState.currentState as AppStateStatus : 'active',
  );
  const studySessionId = snapshot?.id;
  const canControl = snapshot?.canControl;
  const state = snapshot?.state;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!studySessionId || !canControl || state !== 'running' || appState !== 'active') return;

    const controller = new AbortController();
    let requestInFlight = false;
    const sendHeartbeat = async () => {
      if (requestInFlight || controller.signal.aborted) return;
      requestInFlight = true;
      try {
        await heartbeatStudySession(studySessionId, controller.signal);
      } catch {
        // Keep the last confirmed snapshot; the next interval retries this activity signal.
      } finally {
        requestInFlight = false;
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => { void sendHeartbeat(); }, STUDY_SESSION_HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [appState, canControl, state, studySessionId]);
}
