import type { StudySession, StudySessionKind, StudySessionState, StudySessionTerminalReason } from './entities/study-session.entity';
import type { CappedReason } from './domain/session-validator';
import { getStudySessionTime } from './domain/study-session-time';

export type StudySessionSnapshot = {
  id: string;
  kind: StudySessionKind;
  mode: 'solo' | 'guild';
  /** A Raid que recebe a Contribuição quando `mode` é `guild`. */
  raidId: string | null;
  subject: string | null;
  state: StudySessionState;
  /** `null` no Foco livre, que não tem duração planejada. */
  plannedDurationSeconds: number | null;
  startedAt: Date;
  /** No Ciclo, o fim do foco; no Foco livre, o teto do antifraude. */
  runDeadlineAt: Date | null;
  pausedAt: Date | null;
  pausedTotalSeconds: number;
  durationValidSeconds: number;
  /** Sem significado no Foco livre (sempre 0): o cliente conta para cima. */
  remainingSeconds: number;
  serverNow: Date;
  version: number;
  endedAt: Date | null;
  xpAwarded: number;
  terminalReason: StudySessionTerminalReason | null;
  discardedReason: string | null;
  cappedReason: CappedReason | null;
  canControl: boolean;
};

export function studySessionSnapshot(session: StudySession, now: Date): StudySessionSnapshot {
  const deadline = session.runDeadlineAt ?? null;
  const state = session.state ?? 'running';
  const time = getStudySessionTime({ ...session, state }, now);
  const kind = session.kind ?? 'cycle';
  return {
    id: session.id,
    kind,
    mode: session.mode,
    raidId: session.raidId ?? null,
    subject: session.subject,
    state,
    plannedDurationSeconds: kind === 'free' ? null : session.plannedDurationSeconds ?? 1500,
    startedAt: session.startedAt,
    runDeadlineAt: deadline,
    pausedAt: session.pausedAt ?? null,
    pausedTotalSeconds: time.pausedTotalSeconds,
    durationValidSeconds: time.durationValidSeconds,
    remainingSeconds: deadline && kind === 'cycle' ? time.remainingSeconds : 0,
    serverNow: now,
    version: session.version ?? 1,
    endedAt: session.endedAt ?? null,
    xpAwarded: session.xpAwarded ?? 0,
    terminalReason: session.terminalReason ?? null,
    discardedReason: session.discardedReason ?? null,
    cappedReason: session.cappedReason ?? null,
    // D-006: any authenticated Session of the user controls it; the query is already scoped by userId.
    canControl: true,
  };
}

export function deserializeStudySessionSnapshot(value: StudySessionSnapshot | string): StudySessionSnapshot {
  const original = typeof value === 'string' ? JSON.parse(value) as StudySessionSnapshot : value;
  return {
    ...original,
    kind: original.kind ?? 'cycle', // receipts written before the Foco livre have no kind
    raidId: original.raidId ?? null, // receipts written before the guild mode have no raidId
    startedAt: new Date(original.startedAt),
    runDeadlineAt: original.runDeadlineAt ? new Date(original.runDeadlineAt) : null,
    pausedAt: original.pausedAt ? new Date(original.pausedAt) : null,
    serverNow: new Date(original.serverNow),
    endedAt: original.endedAt ? new Date(original.endedAt) : null,
    canControl: true, // receipts written before D-006 may hold false
  };
}
