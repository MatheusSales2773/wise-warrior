import type { StudySessionSnapshot } from './api';

/** How far the server clock is ahead of this device's, as of the moment the snapshot arrived. */
export function studyClockOffset(snapshot: StudySessionSnapshot): number {
  return new Date(snapshot.serverNow).getTime() - snapshot.receivedAtMs;
}

export function remainingStudySeconds(snapshot: StudySessionSnapshot, localNow: number, serverOffsetMs: number): number {
  if (snapshot.state !== 'running' || !snapshot.runDeadlineAt) return snapshot.remainingSeconds;
  return Math.max(0, Math.ceil((new Date(snapshot.runDeadlineAt).getTime() - localNow - serverOffsetMs) / 1000));
}

export function isFreeFocus(snapshot: Pick<StudySessionSnapshot, 'kind'>): boolean {
  return snapshot.kind === 'free';
}

/**
 * Valid focus of a Foco livre, counted up from the snapshot: `durationValidSeconds` is as of `serverNow`, and a
 * running session keeps adding the time since then, never past the antifraude ceiling (`runDeadlineAt`).
 */
export function elapsedStudySeconds(snapshot: StudySessionSnapshot, localNow: number, serverOffsetMs: number): number {
  if (snapshot.state !== 'running') return snapshot.durationValidSeconds;
  const serverNowMs = new Date(snapshot.serverNow).getTime();
  const sinceSnapshot = Math.max(0, Math.floor((localNow + serverOffsetMs - serverNowMs) / 1000));
  const toCeiling = snapshot.runDeadlineAt
    ? Math.max(0, Math.floor((new Date(snapshot.runDeadlineAt).getTime() - serverNowMs) / 1000))
    : sinceSnapshot;
  return snapshot.durationValidSeconds + Math.min(sinceSnapshot, toCeiling);
}

/** `MM:SS`, or `H:MM:SS` from the first hour. */
export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours === 0) return formatRemainingTime(seconds);
  return `${hours}:${formatRemainingTime(seconds % 3600)}`;
}

export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
