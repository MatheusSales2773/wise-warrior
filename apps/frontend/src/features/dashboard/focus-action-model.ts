import type { FocusCycle, StudySessionSnapshot } from '@/features/study-session/api';
import { NO_SUBJECT_LABEL } from '@/features/study-session/subject';
import { elapsedStudySeconds, formatElapsedTime, isFreeFocus, remainingStudySeconds, studyClockOffset } from '@/features/study-session/timer';

export type CycleMarker = 'done' | 'next' | 'pending';

/** The place of the next focus in the Ciclo: `completedInCycle + 1`, never past `cycleLength`. */
export function cycleStep(cycle: FocusCycle): number {
  return Math.min(cycle.completedInCycle + 1, cycle.cycleLength);
}

export function cycleMarkers(cycle: FocusCycle): CycleMarker[] {
  const step = cycleStep(cycle);
  return Array.from({ length: cycle.cycleLength }, (_, index) => (index + 1 < step ? 'done' : index + 1 === step ? 'next' : 'pending'));
}

export function cycleCaption(cycle: FocusCycle): string {
  return `foco ${cycleStep(cycle)} de ${cycle.cycleLength} · depois, pausa ${cycle.nextBreak === 'long' ? 'longa' : 'curta'}`;
}

/** What the "Retomar foco" button shows of the active Study Session. */
export type ActiveFocus = {
  subject: string;
  seconds: number;
  /** A Ciclo shows the time left; a Foco livre, the time elapsed. */
  kind: 'remaining' | 'elapsed';
  paused: boolean;
};

/** Same clock as the Forja: the server deadline corrected by the offset the snapshot arrived with. */
export function activeFocus(snapshot: StudySessionSnapshot, localNow: number): ActiveFocus {
  const offset = studyClockOffset(snapshot);
  const free = isFreeFocus(snapshot);
  return {
    subject: snapshot.subject?.trim() || NO_SUBJECT_LABEL,
    seconds: free ? elapsedStudySeconds(snapshot, localNow, offset) : remainingStudySeconds(snapshot, localNow, offset),
    kind: free ? 'elapsed' : 'remaining',
    paused: snapshot.state === 'paused',
  };
}

function readingTime(focus: ActiveFocus): string {
  return `${formatElapsedTime(focus.seconds)} ${focus.kind === 'remaining' ? 'restantes' : 'decorridos'}`;
}

/** The line above the fixed mobile button: the active session, or else the Ciclo; `null` when neither is known. */
export function focusCaption(cycle: FocusCycle | undefined, focus: ActiveFocus | null): string | null {
  if (focus) return [focus.subject, focus.paused ? 'pausada' : null, readingTime(focus)].filter(Boolean).join(' · ');
  return cycle ? cycleCaption(cycle) : null;
}

/** What the main button says: its label, the mono detail after it (none on the fixed mobile bar) and its spoken name. */
export function focusButtonText(cycle: FocusCycle | undefined, focus: ActiveFocus | null, fixed: boolean): { label: string; detail: string | null; accessibilityLabel: string } {
  if (focus) {
    return {
      label: 'Retomar foco',
      detail: fixed ? null : `· ${focus.subject} · ${formatElapsedTime(focus.seconds)}`,
      accessibilityLabel: `Retomar foco, ${focus.subject}, ${focus.paused ? 'pausada, ' : ''}${readingTime(focus)}`,
    };
  }
  if (cycle) {
    return {
      label: 'Iniciar foco',
      detail: fixed ? null : `· ${cycleStep(cycle)}/${cycle.cycleLength}`,
      accessibilityLabel: `Iniciar foco, ${cycleStep(cycle)} de ${cycle.cycleLength}`,
    };
  }
  return { label: 'Iniciar foco', detail: null, accessibilityLabel: 'Iniciar foco' };
}
