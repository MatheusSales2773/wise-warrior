import type { StudySessionSnapshot } from './api';

export function remainingStudySeconds(snapshot: StudySessionSnapshot, localNow: number, serverOffsetMs: number): number {
  if (snapshot.state !== 'running' || !snapshot.runDeadlineAt) return snapshot.remainingSeconds;
  return Math.max(0, Math.ceil((new Date(snapshot.runDeadlineAt).getTime() - localNow - serverOffsetMs) / 1000));
}

export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
