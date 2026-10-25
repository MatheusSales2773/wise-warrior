import type { FocusCycle, StudySessionSnapshot } from '@/features/study-session/api';
import { NO_SUBJECT_LABEL } from '@/features/study-session/subject';
import { elapsedStudySeconds, formatElapsedTime, isFreeFocus, remainingStudySeconds, studyClockOffset } from '@/features/study-session/timer';

export type CycleMarker = 'done' | 'next' | 'pending';

/** The place of the next focus in the Ciclo: `completedInCycle + 1`, never past `cycleLength`. */
export function cycleStep(cycle: FocusCycle): number {
  return Math.min(cycle.completedInCycle + 1, cycle.cycleLength);
}

/** "3/4", the tail of "Iniciar foco · 3/4". */
export function cycleButtonSuffix(cycle: FocusCycle): string {
  return `${cycleStep(cycle)}/${cycle.cycleLength}`;
}

export function cycleMarkers(cycle: FocusCycle): CycleMarker[] {
  const step = cycleStep(cycle);
  return Array.from({ length: cycle.cycleLength }, (_, index) => (index + 1 < step ? 'done' : index + 1 === step ? 'next' : 'pending'));
}

export function cycleCaption(cycle: FocusCycle): string {
  return `foco ${cycleStep(cycle)} de ${cycle.cycleLength} · depois, pausa ${cycle.nextBreak === 'long' ? 'longa' : 'curta'}`;
}

/** What the "Retomar foco" button shows of the active Study Session. */
export type ActiveFocusReading = {
  subject: string;
  seconds: number;
  /** A Ciclo shows the time left; a Foco livre, the time elapsed. */
  kind: 'remaining' | 'elapsed';
  paused: boolean;
};

/** Same clock as the Forja: the server deadline corrected by the offset the snapshot arrived with. */
export function activeFocusReading(snapshot: StudySessionSnapshot, localNow: number): ActiveFocusReading {
  const offset = studyClockOffset(snapshot);
  const free = isFreeFocus(snapshot);
  return {
    subject: snapshot.subject?.trim() || NO_SUBJECT_LABEL,
    seconds: free ? elapsedStudySeconds(snapshot, localNow, offset) : remainingStudySeconds(snapshot, localNow, offset),
    kind: free ? 'elapsed' : 'remaining',
    paused: snapshot.state === 'paused',
  };
}

/** "Cálculo II · 18:42", after "Retomar foco ·". */
export function resumeDetail(reading: ActiveFocusReading): string {
  return `${reading.subject} · ${formatElapsedTime(reading.seconds)}`;
}

export function resumeAccessibilityLabel(reading: ActiveFocusReading): string {
  const time = `${formatElapsedTime(reading.seconds)} ${reading.kind === 'remaining' ? 'restantes' : 'decorridos'}`;
  return `Retomar foco, ${reading.subject}, ${reading.paused ? 'pausada, ' : ''}${time}`;
}

/** The line above the fixed mobile button: "Cálculo II · pausada · 18:42 restantes". */
export function resumeCaption(reading: ActiveFocusReading): string {
  const time = `${formatElapsedTime(reading.seconds)} ${reading.kind === 'remaining' ? 'restantes' : 'decorridos'}`;
  return [reading.subject, reading.paused ? 'pausada' : null, time].filter(Boolean).join(' · ');
}
