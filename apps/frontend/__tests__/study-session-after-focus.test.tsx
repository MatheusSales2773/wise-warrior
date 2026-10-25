import { act, fireEvent, render, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, processColor } from 'react-native';
import { theme } from '@/design-system';
import { getObjectives, type Objectives } from '@/features/chronicles/api';
import { getMyProfile, getSessionHistory, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import { getActiveRaid, getMyGuild } from '@/features/guild/api';
import {
  completeStudySession,
  getActiveStudySession,
  getFocusCycle,
  stopStudySession,
  type FocusCycle,
  type StudySessionSnapshot,
  type StudySessionTransitionResult,
} from '@/features/study-session/api';
import { clearCompletionIntent } from '@/features/study-session/completion-intent';
import { startBreak } from '@/features/study-session/pomodoro-break';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { useStudySessionAppActive } from '@/features/study-session/use-study-session-app-active';
import { devicePreferences } from '@/core/preferences/device-preferences';

// The state after the focus: the Resultado and the Pausa Pomodoro of the Forja v2 (#322).
jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/guild/api', () => ({ getMyGuild: jest.fn(), getActiveRaid: jest.fn(), joinRaid: jest.fn() }));
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(), getSessionMetrics: jest.fn(), getRecentStudySessions: jest.fn(), getSessionHistory: jest.fn(), getWeekSummary: jest.fn(),
}));
jest.mock('@/features/chronicles/api', () => ({ getObjectives: jest.fn(), getMilestones: jest.fn() }));
jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));
jest.mock('@/features/study-session/sounds', () => ({
  playSessionSound: jest.fn(), releaseSessionSounds: jest.fn(), stopSessionSounds: jest.fn(), unlockSessionSounds: jest.fn(),
}));
jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  completeStudySession: jest.fn(),
  getActiveStudySession: jest.fn(),
  getFocusCycle: jest.fn(),
  getRecentStudySessionSubjects: jest.fn(async () => []),
  heartbeatStudySession: jest.fn(),
  pauseStudySession: jest.fn(),
  resumeStudySession: jest.fn(),
  startStudySession: jest.fn(),
  stopStudySession: jest.fn(),
}));
jest.mock('@/features/study-session/use-study-session-app-active', () => ({
  useStudySessionAppActive: jest.fn(() => true),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const complete = completeStudySession as jest.MockedFunction<typeof completeStudySession>;
const stop = stopStudySession as jest.MockedFunction<typeof stopStudySession>;
const cycle = getFocusCycle as jest.MockedFunction<typeof getFocusCycle>;
const profile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const metrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;
const history = getSessionHistory as jest.MockedFunction<typeof getSessionHistory>;
const objectives = getObjectives as jest.MockedFunction<typeof getObjectives>;
const myGuild = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const activeRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;
const appActive = useStudySessionAppActive as jest.MockedFunction<typeof useStudySessionAppActive>;

let mockedNow: number;
let timerTick: (() => void) | undefined;
const queryClients: QueryClient[] = [];

const running: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', raidId: null, subject: 'Cálculo II', state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 0, remainingSeconds: 1500,
  serverNow: '2026-09-22T12:00:00.000Z', version: 1, endedAt: null, xpAwarded: 0, pauseCount: 0,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:00:00.000Z').getTime(),
};

function atZero(): StudySessionSnapshot {
  return {
    ...running,
    remainingSeconds: 0,
    runDeadlineAt: new Date(mockedNow).toISOString(),
    serverNow: new Date(mockedNow).toISOString(),
    receivedAtMs: mockedNow,
  };
}

const completedResult = (overrides: Partial<StudySessionTransitionResult> = {}): StudySessionTransitionResult => ({
  ...atZero(), raidContribution: null, state: 'completed', endedAt: new Date(mockedNow).toISOString(),
  durationValidSeconds: 1500, xpAwarded: 250, terminalReason: 'auto-complete', ...overrides,
});

const inCycle = (completedInCycle: number): FocusCycle => ({
  completedInCycle,
  cycleLength: 4,
  nextBreak: completedInCycle === 4 ? 'long' : 'short',
});

const user: UserProfile = {
  id: 'u-1', email: 'k@wise.app', displayName: 'Knightshade', planTier: 'free', level: 14,
  levelStartXp: 8000, nextLevelXp: 10_000, xpTotal: 9200, title: null, equipped: [],
};
const week: SessionMetrics = {
  currentStreakDays: 27, longestStreakDays: 30, sessionsToday: 3, validSecondsToday: 5700,
  cadence: { windowStart: '2026-09-16', windowEnd: '2026-09-22', days: [] },
};
const objectivesWith = (progress: number): Objectives => ({
  daily: {
    date: '2026-09-22', renewsAt: '2026-09-23T03:00:00.000Z',
    items: [{ id: 'four-sessions', title: 'Conclua 4 sessões hoje', progress, target: 4, coins: 20, completed: progress >= 4 }],
  },
  weekly: { weekStart: '2026-09-21', renewsAt: '2026-09-28T03:00:00.000Z', items: [] },
});

function windowWidth(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 }, screen: { width, height: 900, scale: 1, fontScale: 1 } });
}

const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');

async function renderAfterFocus(result: StudySessionTransitionResult, focusCycle: FocusCycle = inCycle(3)) {
  getActive.mockResolvedValue(atZero());
  complete.mockResolvedValue(result);
  cycle.mockResolvedValue(focusCycle);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  queryClients.push(client);
  const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
  await view.findByTestId('study-session-result');
  return view;
}

async function renderBreak(kind: 'short' | 'long', focusCycle: FocusCycle) {
  const view = await renderAfterFocus(completedResult(), focusCycle);
  await fireEvent.press(await view.findByRole('button', { name: kind === 'short' ? 'Iniciar pausa curta' : 'Iniciar pausa longa' }));
  await view.findByTestId('study-session-break');
  return view;
}

/** The colour of the arc of a ring, read from the native Svg: the track is drawn first, the arc over it. */
function arcStroke(view: Awaited<ReturnType<typeof renderAfterFocus>>, timerTestID: string): unknown {
  const ring = view.getByTestId(`${timerTestID}-ring`, { includeHiddenElements: true });
  const circles = (node: any): any[] => (typeof node === 'string' ? [] : [...(node.type === 'RNSVGCircle' ? [node] : []), ...node.children.flatMap(circles)]);
  return circles(ring).at(-1)?.props.stroke?.payload;
}

/** How much of the arc is left undrawn: zero on a closed ring. */
function arcOffset(view: Awaited<ReturnType<typeof renderAfterFocus>>, timerTestID: string): unknown {
  const ring = view.getByTestId(`${timerTestID}-ring`, { includeHiddenElements: true });
  const circles = (node: any): any[] => (typeof node === 'string' ? [] : [...(node.type === 'RNSVGCircle' ? [node] : []), ...node.children.flatMap(circles)]);
  return Number(circles(ring).at(-1)?.props.strokeDashoffset);
}

const advance = (seconds: number) => act(async () => {
  mockedNow += seconds * 1000;
  timerTick?.();
});

beforeEach(async () => {
  await devicePreferences.set('confirmBeforeStopping', false);
  clearCompletionIntent();
  mockedNow = new Date('2026-09-22T12:00:00.000Z').getTime();
  timerTick = undefined;
  appActive.mockReturnValue(true);
  profile.mockResolvedValue(user);
  metrics.mockResolvedValue(week);
  objectives.mockResolvedValue(objectivesWith(3));
  history.mockResolvedValue({ items: [], nextCursor: null });
  myGuild.mockResolvedValue(null);
  activeRaid.mockResolvedValue(null);
  jest.spyOn(Date, 'now').mockImplementation(() => mockedNow);
  const nativeSetInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay === 1000) {
      timerTick = callback;
      return 0 as unknown as ReturnType<typeof setInterval>;
    }
    return nativeSetInterval(callback, delay);
  }) as typeof setInterval);
});

afterEach(() => {
  clearCompletionIntent();
  queryClients.splice(0).forEach((client) => client.clear());
  Dimensions.set({ window: originalWindow, screen: originalScreen });
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('Pausa Pomodoro (desktop)', () => {
  beforeEach(() => windowWidth(1440));

  it('draws the short break in its own ring colour, with the countdown and "sem XP"', async () => {
    const view = await renderBreak('short', inCycle(3));

    expect(view.getByText('◈ PAUSA CURTA ◈')).toBeTruthy();
    expect(view.getByTestId('study-session-break-timer').props.children).toBe('05:00');
    expect(view.getByText('restantes · 5 min · sem XP')).toBeTruthy();
    // The arc takes a token of the design system, not the Forja's gold.
    expect(arcStroke(view, 'study-session-break-timer')).toBe(processColor(theme.color.feedbackInfo));
  });

  it('rests the Herói beside the anvil and recalls the last session under it', async () => {
    const view = await renderBreak('short', inCycle(3));

    expect(await view.findByText('Knightshade descansa ao lado da bigorna')).toBeTruthy();
    expect(view.queryAllByTestId('study-session-spark')).toHaveLength(0);
    const xp = within(view.getByTestId('study-session-summary-xp'));
    expect(xp.getByText('+250 XP')).toBeTruthy();
    expect(xp.getByText('na última sessão')).toBeTruthy();
  });

  it('shows "Hora de descansar" with the previous session and skips the break', async () => {
    const view = await renderBreak('short', inCycle(3));

    const card = within(view.getByTestId('study-session-break-card'));
    expect(card.getByText('Hora de descansar')).toBeTruthy();
    expect(card.getByText('FORJA 3 DE 4')).toBeTruthy();
    expect(card.getByText('Cálculo II')).toBeTruthy();
    expect(card.getByText('25:00')).toBeTruthy();
    expect(card.getByText('+250')).toBeTruthy();
    expect(card.getByText('Pausa longa')).toBeTruthy();
    expect(card.getByText('após 1 foco')).toBeTruthy();
    expect(card.getByText('Descanse. O contador segue mesmo se você sair desta tela.')).toBeTruthy();

    await fireEvent.press(card.getByRole('button', { name: 'Pular pausa' }));
    await view.findByTestId('study-session-setup');
  });

  it('counts what is left for the meta once the session already counts, beside the next level', async () => {
    const view = await renderBreak('short', inCycle(3));

    expect(await view.findByText('Falta 1 sessão para a meta de 4.')).toBeTruthy();
    expect(await view.findByText('Faltam 800 XP para o nível 15.')).toBeTruthy();
  });

  it('runs the long break for 15 minutes and leaves out the line that points to it', async () => {
    const view = await renderBreak('long', inCycle(4));

    expect(view.getByText('◈ PAUSA LONGA ◈')).toBeTruthy();
    expect(view.getByText('restantes · 15 min · sem XP')).toBeTruthy();
    expect(within(view.getByTestId('study-session-break-card')).queryByText('Pausa longa')).toBeNull();
  });

  it('draws what is left of the break, so the arc empties as the clock runs', async () => {
    const view = await renderBreak('short', inCycle(3));
    const circumference = 2 * Math.PI * 154;
    expect(arcOffset(view, 'study-session-break-timer')).toBeCloseTo(0);

    await advance(150);

    expect(arcOffset(view, 'study-session-break-timer')).toBeCloseTo(circumference / 2, 0);
  });

  it('finishes with "Pausa concluída. Pronto para outra forja?" and Nova sessão', async () => {
    const view = await renderBreak('short', inCycle(3));

    await advance(300);

    expect(view.getByText('Pausa concluída. Pronto para outra forja?')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Pular pausa' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Nova sessão' }));
    await view.findByTestId('study-session-setup');
  });

  it('shows the previous session of a break that was already running when the Forja opened', async () => {
    getActive.mockResolvedValue(null);
    cycle.mockResolvedValue(inCycle(3));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClients.push(client);
    startBreak(client, 'short', mockedNow, { subject: 'Cálculo II', validSeconds: 1500, xpAwarded: 250, completedInCycle: 3 });

    const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);

    await view.findByTestId('study-session-break');
    expect(within(view.getByTestId('study-session-break-card')).getByText('Cálculo II')).toBeTruthy();
    view.unmount();
  });
});

describe('Pausa Pomodoro (mobile)', () => {
  beforeEach(() => windowWidth(390));

  it('keeps the same facts in a strip, with the skip pinned above the tab bar', async () => {
    const view = await renderBreak('short', inCycle(3));

    expect(view.getByText('Pausa curta')).toBeTruthy();
    expect(view.getByText('5 min · sem XP')).toBeTruthy();
    const strip = within(view.getByTestId('study-session-strip'));
    expect(strip.getByText('Cálculo II')).toBeTruthy();
    expect(strip.getByText('última sessão')).toBeTruthy();
    expect(strip.getByText('3 de 4')).toBeTruthy();
    expect(strip.getByText('forja')).toBeTruthy();
    expect(strip.getByText('+250 XP')).toBeTruthy();
    expect(strip.getByText('confirmado')).toBeTruthy();
    expect(view.getByText('Descanse. O contador segue mesmo se você sair desta tela.')).toBeTruthy();
    expect(within(view.getByTestId('study-session-footer')).getByRole('button', { name: 'Pular pausa' })).toBeTruthy();
  });
});

const finished = (overrides: Partial<StudySessionTransitionResult>) => completedResult(overrides);

describe('Resultado (desktop)', () => {
  beforeEach(() => windowWidth(1440));

  it('closes the ring on the same Bigorna with the valid focus confirmed', async () => {
    const view = await renderAfterFocus(completedResult());

    expect(view.getByText('◈ Sessão concluída ◈')).toBeTruthy();
    expect(view.getByTestId('study-session-result-timer').props.children).toBe('25:00');
    expect(view.getByText('foco válido confirmado')).toBeTruthy();
    expect(arcOffset(view, 'study-session-result-timer')).toBe(0);
    expect(await view.findByText('Knightshade forjou 25 minutos · Cálculo II')).toBeTruthy();
    expect(view.getAllByTestId('study-session-spark').length).toBeGreaterThan(0);
    const xp = within(view.getByTestId('study-session-summary-xp'));
    expect(xp.getByText('+250 XP')).toBeTruthy();
    expect(xp.getByText('confirmado')).toBeTruthy();
  });

  it('lists the session in the result card and offers the break with the cycle position', async () => {
    const view = await renderAfterFocus(completedResult({ pauseCount: 1 }));

    const card = within(view.getByTestId('study-session-result-card'));
    expect(card.getByText('Sessão concluída')).toBeTruthy();
    expect(card.getByText('SOLO')).toBeTruthy();
    expect(card.getByTestId('study-session-result-subject')).toHaveTextContent('Cálculo II');
    expect(card.getByText('25 min')).toBeTruthy();
    expect(card.getByText('25:00')).toBeTruthy();
    expect(card.getByTestId('study-session-pause-count')).toHaveTextContent(/^Pausas\s*1$/);
    expect(await card.findByText('Forja 3 de 4')).toBeTruthy();
    expect(card.getByText('Pausa curta de 5 minutos. Não concede XP.')).toBeTruthy();
    expect(card.getByRole('button', { name: 'Iniciar pausa curta' })).toBeTruthy();
    expect(card.getByRole('button', { name: 'Nova sessão' })).toBeTruthy();
  });

  it('offers the long break after the fourth focus', async () => {
    const view = await renderAfterFocus(completedResult(), inCycle(4));

    expect(await view.findByText('Forja 4 de 4')).toBeTruthy();
    expect(view.getByText('Quatro focos concluídos. Pausa longa de 15 minutos, sem XP.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Iniciar pausa longa' })).toBeTruthy();
  });

  it('lists the sessions of the day beside the result', async () => {
    history.mockResolvedValue({
      items: [{
        id: 'h-1', subject: 'Cálculo II', mode: 'solo', state: 'completed', startedAt: '2026-09-22T12:00:00.000Z',
        endedAt: '2026-09-22T12:25:00.000Z', durationValidSeconds: 1500, xpAwarded: 250, discardedReason: null, cappedReason: null, cyclePosition: 3,
      }],
      nextCursor: null,
    });
    const view = await renderAfterFocus(completedResult());

    expect(await within(view.getByTestId('study-session-today-card')).findByText('Cálculo II · 25:00 · +250 XP')).toBeTruthy();
  });

  it('offers no break after an early stop and says so in the card', async () => {
    const view = await renderAfterFocus(finished({ state: 'stopped_early', durationValidSeconds: 900, xpAwarded: 150, terminalReason: 'manual-stop' }));

    const card = within(view.getByTestId('study-session-result-card'));
    expect(card.getByText('Sessão encerrada antecipadamente')).toBeTruthy();
    expect(card.getByText('15:00')).toBeTruthy();
    expect(card.queryByRole('button', { name: /Iniciar pausa/ })).toBeNull();
    expect(card.getByRole('button', { name: 'Nova sessão' })).toBeTruthy();
    expect(view.queryByTestId('study-session-break-offer')).toBeNull();
  });

  it.each([
    ['daily-limit', 'XP limitado pelo teto diário.'],
    ['continuous-limit', 'XP limitado ao máximo de sessão contínua.'],
  ] as const)('names the cap when %s truncated the XP', async (cappedReason, copy) => {
    const view = await renderAfterFocus(finished({ cappedReason }));

    expect(view.getByTestId('study-session-result-capped')).toHaveTextContent(copy);
  });

  it.each([
    ['continuous-session-exceeds-limit', 'A duração ultrapassou o limite de foco permitido.'],
    ['daily-limit', 'O limite diário de foco foi atingido.'],
  ])('tells why a session was not counted: %s', async (discardedReason, copy) => {
    const view = await renderAfterFocus(finished({ state: 'discarded', discardedReason, xpAwarded: 0, durationValidSeconds: 0 }));

    const card = within(view.getByTestId('study-session-result-card'));
    expect(card.getByText('Sessão não contabilizada')).toBeTruthy();
    expect(card.getByText(copy)).toBeTruthy();
    expect(card.queryByRole('button', { name: /Iniciar pausa/ })).toBeNull();
  });

  it.each([
    [{ status: 'counted', xpContributed: 250 }, '+250 XP para a Raid da Guilda.'],
    [{ status: 'outside-raid-window', xpContributed: 0 }, 'Esta sessão não contou para a Raid: terminou fora da janela da Raid.'],
    [{ status: 'no-validated-xp', xpContributed: 0 }, 'Esta sessão não contou para a Raid: não houve XP validado.'],
  ] as const)('reports the Raid contribution %j', async (raidContribution, copy) => {
    const view = await renderAfterFocus(finished({ mode: 'guild', raidId: 'raid-1', raidContribution }));

    expect(within(view.getByTestId('study-session-result-card')).getByText('GUILDA')).toBeTruthy();
    expect(view.getByTestId('study-session-result-raid-contribution')).toHaveTextContent(copy);
  });

  it('offers no break after a Foco livre', async () => {
    const free = { kind: 'free' as const, plannedDurationSeconds: null };
    getActive.mockResolvedValue({ ...atZero(), ...free });
    complete.mockResolvedValue(completedResult({ ...free, durationValidSeconds: 1900, xpAwarded: 310 }));
    cycle.mockResolvedValue(inCycle(1));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
    queryClients.push(client);
    const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);

    const card = within(await view.findByTestId('study-session-result-card'));
    expect(card.getByText('Foco livre')).toBeTruthy();
    expect(card.queryByRole('button', { name: /Iniciar pausa/ })).toBeNull();
    expect(view.queryByTestId('study-session-break-offer')).toBeNull();
  });
});

describe('Resultado (mobile)', () => {
  beforeEach(() => windowWidth(390));

  it('keeps the same facts, with Nova sessão and the break pinned above the tab bar', async () => {
    const view = await renderAfterFocus(completedResult());

    expect(view.getByText('Concluída')).toBeTruthy();
    expect(view.getByText('foco válido confirmado')).toBeTruthy();
    const strip = within(view.getByTestId('study-session-strip'));
    expect(strip.getByText('Cálculo II')).toBeTruthy();
    expect(strip.getByText('matéria')).toBeTruthy();
    expect(strip.getByText('25 min')).toBeTruthy();
    expect(strip.getByText('planejado')).toBeTruthy();
    expect(strip.getByText('+250 XP')).toBeTruthy();
    expect(strip.getByText('confirmado')).toBeTruthy();
    expect(await view.findByText('Forja 3 de 4')).toBeTruthy();
    const footer = within(view.getByTestId('study-session-footer'));
    expect(footer.getByRole('button', { name: 'Nova sessão' })).toBeTruthy();
    expect(footer.getByRole('button', { name: 'Iniciar pausa curta' })).toBeTruthy();
  });

  it('pins only Nova sessão when there is no break to offer', async () => {
    const view = await renderAfterFocus(finished({ state: 'stopped_early', durationValidSeconds: 900, xpAwarded: 150 }));

    const footer = within(view.getByTestId('study-session-footer'));
    expect(footer.getByRole('button', { name: 'Nova sessão' })).toBeTruthy();
    expect(footer.queryByRole('button', { name: /pausa/i })).toBeNull();
  });
});

void stop;
