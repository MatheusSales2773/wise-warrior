import type { FocusCycle, StudySessionSnapshot } from '@/features/study-session/api';
import { activeFocusReading, cycleButtonSuffix, cycleCaption, cycleMarkers, cycleStep, resumeAccessibilityLabel, resumeCaption, resumeDetail } from '@/features/dashboard/focus-action-model';

const cycle = (completedInCycle: number, nextBreak: FocusCycle['nextBreak'] = 'short'): FocusCycle => ({ completedInCycle, cycleLength: 4, nextBreak });

const snapshot = (overrides: Partial<StudySessionSnapshot> = {}): StudySessionSnapshot => ({
  id: 's1', kind: 'cycle', mode: 'solo', raidId: null, subject: 'Cálculo II', state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-17T12:00:00.000Z', runDeadlineAt: '2026-09-17T12:25:00.000Z', pausedAt: null, pausedTotalSeconds: 0,
  durationValidSeconds: 0, remainingSeconds: 1500, serverNow: '2026-09-17T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true, receivedAtMs: Date.parse('2026-09-17T12:00:00.000Z'), ...overrides,
});

describe('Ciclo Pomodoro', () => {
  it('numbers the next focus as completedInCycle + 1 of cycleLength', () => {
    expect(cycleStep(cycle(0))).toBe(1);
    expect(cycleStep(cycle(2))).toBe(3);
    expect(cycleButtonSuffix(cycle(2))).toBe('3/4');
  });

  it('never numbers past the last focus of the Ciclo', () => {
    expect(cycleStep(cycle(4))).toBe(4);
  });

  it('marks the focuses done, the next one and those still pending', () => {
    expect(cycleMarkers(cycle(2))).toEqual(['done', 'done', 'next', 'pending']);
    expect(cycleMarkers(cycle(0))).toEqual(['next', 'pending', 'pending', 'pending']);
  });

  it('says which break follows the next focus', () => {
    expect(cycleCaption(cycle(2, 'long'))).toBe('foco 3 de 4 · depois, pausa longa');
    expect(cycleCaption(cycle(0, 'short'))).toBe('foco 1 de 4 · depois, pausa curta');
  });
});

describe('Retomar foco', () => {
  const at = (iso: string) => Date.parse(iso);

  it('counts the remaining time of a running Ciclo down from the server deadline', () => {
    const reading = activeFocusReading(snapshot(), at('2026-09-17T12:06:18.000Z'));
    expect(reading).toEqual({ subject: 'Cálculo II', seconds: 1122, kind: 'remaining', paused: false });
  });

  it('corrects the device clock with the offset the snapshot arrived with', () => {
    // The device clock is 10 minutes behind the server: it read 11:50 when the server said 12:00.
    const behind = snapshot({ receivedAtMs: at('2026-09-17T11:50:00.000Z') });
    expect(activeFocusReading(behind, at('2026-09-17T11:56:18.000Z')).seconds).toBe(1122);
  });

  it('keeps the remaining time of a paused session frozen', () => {
    const paused = snapshot({ state: 'paused', pausedAt: '2026-09-17T12:07:00.000Z', remainingSeconds: 1080, runDeadlineAt: null });
    expect(activeFocusReading(paused, at('2026-09-17T13:00:00.000Z'))).toEqual({ subject: 'Cálculo II', seconds: 1080, kind: 'remaining', paused: true });
  });

  it('counts a Foco livre up from its valid focus', () => {
    const free = snapshot({ kind: 'free', plannedDurationSeconds: null, runDeadlineAt: '2026-09-17T14:00:00.000Z', durationValidSeconds: 60, remainingSeconds: 0 });
    expect(activeFocusReading(free, at('2026-09-17T12:02:00.000Z'))).toEqual({ subject: 'Cálculo II', seconds: 180, kind: 'elapsed', paused: false });
  });

  it('names a session without Matéria "Sem matéria"', () => {
    expect(activeFocusReading(snapshot({ subject: null }), at('2026-09-17T12:00:00.000Z')).subject).toBe('Sem matéria');
    expect(activeFocusReading(snapshot({ subject: '   ' }), at('2026-09-17T12:00:00.000Z')).subject).toBe('Sem matéria');
  });

  it('writes the button detail and its spoken label with the time as minutes and seconds', () => {
    const reading = { subject: 'Cálculo II', seconds: 1122, kind: 'remaining', paused: true } as const;
    expect(resumeDetail(reading)).toBe('Cálculo II · 18:42');
    expect(resumeAccessibilityLabel(reading)).toBe('Retomar foco, Cálculo II, pausada, 18:42 restantes');
    const free = { subject: 'Sem matéria', seconds: 3725, kind: 'elapsed', paused: false } as const;
    expect(resumeDetail(free)).toBe('Sem matéria · 1:02:05');
    expect(resumeCaption(reading)).toBe('Cálculo II · pausada · 18:42 restantes');
    expect(resumeCaption(free)).toBe('Sem matéria · 1:02:05 decorridos');
    expect(resumeAccessibilityLabel(free)).toBe('Retomar foco, Sem matéria, 1:02:05 decorridos');
  });
});
