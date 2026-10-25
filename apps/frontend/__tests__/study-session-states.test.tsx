import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, StyleSheet } from 'react-native';
import { getObjectives, type Objectives } from '@/features/chronicles/api';
import { getMyProfile, getSessionMetrics, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import { getActiveRaid, getMyGuild } from '@/features/guild/api';
import { getActiveStudySession, type StudySessionSnapshot } from '@/features/study-session/api';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { devicePreferences } from '@/core/preferences/device-preferences';
import { clearCompletionIntent } from '@/features/study-session/completion-intent';
import { formatFocusToday, xpForFocus } from '@/features/study-session/xp';

// The day history has its own test (forge-history.test.tsx).
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
  getActiveStudySession: jest.fn(),
  getRecentStudySessionSubjects: jest.fn(async () => []),
  heartbeatStudySession: jest.fn(),
  pauseStudySession: jest.fn(),
  resumeStudySession: jest.fn(),
  stopStudySession: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const profile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const metrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;
const objectives = getObjectives as jest.MockedFunction<typeof getObjectives>;
const myGuild = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const activeRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;

const snapshot: StudySessionSnapshot = {
  id: 'study-1', mode: 'solo', raidId: null, subject: 'Cálculo II', state: 'running', plannedDurationSeconds: 1500,
  startedAt: '2026-09-22T12:00:00.000Z', runDeadlineAt: '2026-09-22T12:25:00.000Z',
  pausedAt: null, pausedTotalSeconds: 0, durationValidSeconds: 628, remainingSeconds: 872,
  serverNow: '2026-09-22T12:10:28.000Z', version: 1, endedAt: null, xpAwarded: 0, pauseCount: 1,
  terminalReason: null, discardedReason: null, canControl: true,
  receivedAtMs: new Date('2026-09-22T12:10:28.000Z').getTime(),
};
const paused: StudySessionSnapshot = { ...snapshot, state: 'paused', pausedAt: snapshot.serverNow, runDeadlineAt: null, version: 2 };
const free: StudySessionSnapshot = { ...snapshot, kind: 'free', plannedDurationSeconds: null, durationValidSeconds: 1900, remainingSeconds: 0, runDeadlineAt: '2026-09-22T14:00:00.000Z', pauseCount: 0 };
const guildSession: StudySessionSnapshot = { ...snapshot, mode: 'guild', raidId: 'raid-1' };

const user: UserProfile = {
  id: 'u-1', email: 'k@wise.app', displayName: 'Knightshade', planTier: 'free', level: 14,
  levelStartXp: 8000, nextLevelXp: 10_000, xpTotal: 8950, title: null, equipped: [],
};
const week: SessionMetrics = {
  currentStreakDays: 27, longestStreakDays: 30, sessionsToday: 2, validSecondsToday: 4800,
  cadence: { windowStart: '2026-09-16', windowEnd: '2026-09-22', days: [] },
};
const objectivesWith = (progress: number): Objectives => ({
  daily: {
    date: '2026-09-22', renewsAt: '2026-09-23T03:00:00.000Z',
    items: [{ id: 'four-sessions', title: 'Conclua 4 sessões hoje', progress, target: 4, coins: 20, completed: progress >= 4 }],
  },
  weekly: { weekStart: '2026-09-21', renewsAt: '2026-09-28T03:00:00.000Z', items: [] },
});
const raid = { id: 'raid-1', status: 'active', mission: { slug: 'cerco', name: 'Cerco ao Grimório', description: '', imageUrl: null }, me: { participating: true } };

async function renderForge() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
  await view.findByTestId('study-session-active');
  return view;
}

function expectStat(view: Awaited<ReturnType<typeof renderForge>>, testID: string, value: string, label: string) {
  const stat = within(view.getByTestId(testID));
  expect(stat.getByText(value)).toBeTruthy();
  expect(stat.getByText(label)).toBeTruthy();
}

function windowWidth(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 }, screen: { width, height: 900, scale: 1, fontScale: 1 } });
}

const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');

beforeEach(() => {
  clearCompletionIntent();
  getActive.mockResolvedValue(snapshot);
  profile.mockResolvedValue(user);
  metrics.mockResolvedValue(week);
  objectives.mockResolvedValue(objectivesWith(2));
  myGuild.mockResolvedValue(null);
  activeRaid.mockResolvedValue(null);
  void devicePreferences.set('confirmBeforeStopping', false);
});

afterEach(() => {
  Dimensions.set({ window: originalWindow, screen: originalScreen });
  jest.clearAllMocks();
});

describe('Em andamento (desktop)', () => {
  beforeEach(() => windowWidth(1440));

  it('shows the ring, the Herói with sparks, the summary and the session card', async () => {
    const view = await renderForge();

    expect(view.getByText('◈ Sessão em andamento ◈')).toBeTruthy();
    expect(view.getByText('restantes · foco válido 10:28')).toBeTruthy();
    expect(await view.findByText('Knightshade está forjando · Cálculo II')).toBeTruthy();
    expect(view.getAllByTestId('study-session-spark').length).toBeGreaterThan(0);
    expectStat(view, 'study-session-summary-xp', '+250 XP', 'ao concluir');
    await view.findByTestId('study-session-summary-streak');
    expectStat(view, 'study-session-summary-streak', '27 dias', 'constância');
    expectStat(view, 'study-session-summary-today', '1h 20min', 'foco hoje');
    expect(view.getByTestId('study-session-mode-tag')).toHaveTextContent('SOLO');
    expect(view.getByTestId('study-session-subject')).toHaveTextContent('Cálculo II');
    expect(view.getByTestId('study-session-pause-count')).toHaveTextContent(/^Pausas\s*1$/);
    expect(view.getByText('Encerrar antes do fim registra apenas o foco válido até agora.')).toBeTruthy();
    expect(view.queryByTestId('study-session-footer')).toBeNull();
    expect(view.getByRole('button', { name: 'Pausar sessão' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Encerrar antecipadamente' })).toBeTruthy();
    view.unmount();
  });

  it('shows the goal and the next level under "Enquanto isso"', async () => {
    const view = await renderForge();

    expect(await view.findByText('Concluindo esta, falta 1 sessão para a meta de 4.')).toBeTruthy();
    expect(await view.findByText('Faltam 1.050 XP para o nível 15.')).toBeTruthy();
    expect(view.queryByTestId('study-session-meanwhile-raid')).toBeNull();
    view.unmount();
  });

  it('drops the goal line once the Objetivo is done', async () => {
    objectives.mockResolvedValue(objectivesWith(4));
    const view = await renderForge();

    await view.findByText('Faltam 1.050 XP para o nível 15.');
    expect(view.queryByTestId('study-session-meanwhile-goal')).toBeNull();
    view.unmount();
  });

  it('drops the level line, and names the Herói generically, when the profile fails', async () => {
    objectives.mockResolvedValue(objectivesWith(1));
    profile.mockRejectedValue(new Error('offline'));
    const view = await renderForge();

    await view.findByText('Concluindo esta, faltam 2 sessões para a meta de 4.');
    expect(view.queryByTestId('study-session-meanwhile-level')).toBeNull();
    expect(view.getByText('Seu Herói está forjando · Cálculo II')).toBeTruthy();
    view.unmount();
  });

  it('leaves out "Enquanto isso" when no line has data', async () => {
    objectives.mockRejectedValue(new Error('offline'));
    profile.mockRejectedValue(new Error('offline'));
    metrics.mockRejectedValue(new Error('offline'));
    const view = await renderForge();

    await waitFor(() => expect(metrics).toHaveBeenCalled());
    expect(view.queryByTestId('study-session-meanwhile')).toBeNull();
    expect(view.queryByTestId('study-session-summary-streak')).toBeNull();
    expect(view.getByTestId('study-session-summary-xp')).toBeTruthy();
    view.unmount();
  });

  it('tags a guild session and adds the Golpe line of its Raid', async () => {
    getActive.mockResolvedValue(guildSession);
    myGuild.mockResolvedValue({ guild: { id: 'g-1' } } as Awaited<ReturnType<typeof getMyGuild>>);
    activeRaid.mockResolvedValue(raid as unknown as Awaited<ReturnType<typeof getActiveRaid>>);
    const view = await renderForge();

    expect(view.getByTestId('study-session-mode-tag')).toHaveTextContent('GUILDA');
    expect(await view.findByText('Ao concluir, o XP vira um Golpe na Raid Cerco ao Grimório.')).toBeTruthy();
    expect(view.getByText('Knightshade está forjando para a Raid · Cálculo II')).toBeTruthy();
    view.unmount();
  });

  it('keeps the Foco livre on the elapsed time, with "Parar e concluir" and its warning', async () => {
    getActive.mockResolvedValue(free);
    const view = await renderForge();

    expect(view.getByText('◈ Foco livre em andamento ◈')).toBeTruthy();
    expect(view.getByText('decorridos · foco válido 31:40')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('study-session-timer-ring', { includeHiddenElements: true }).props.style).opacity).toBeUndefined();
    expectStat(view, 'study-session-summary-xp', '+310 XP', 'até agora');
    expect(view.getByText('Tipo')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Parar e concluir' })).toBeTruthy();
    expect(view.getByText('Parar conclui o foco livre. Com menos de 5 minutos de foco, não concede XP.')).toBeTruthy();
    expect(view.queryByText('Duração planejada')).toBeNull();
    view.unmount();
  });
});

describe('Pausada', () => {
  it('dims the ring, drops the sparks and offers Retomar (desktop)', async () => {
    windowWidth(1440);
    getActive.mockResolvedValue(paused);
    const view = await renderForge();

    expect(view.getByText('◈ Sessão pausada ◈')).toBeTruthy();
    expect(view.getByText('pausada · foco válido 10:28')).toBeTruthy();
    expect(await view.findByText('Knightshade descansa a marreta · Cálculo II')).toBeTruthy();
    expect(view.queryAllByTestId('study-session-spark')).toHaveLength(0);
    expect(StyleSheet.flatten(view.getByTestId('study-session-timer-ring', { includeHiddenElements: true }).props.style).opacity).toBe(0.45);
    expect(view.getByRole('button', { name: 'Retomar sessão' })).toBeTruthy();
    expect(view.getByTestId('study-session-pause-count')).toHaveTextContent(/^Pausas\s*1$/);
    view.unmount();
  });

  it('shows "Pausada" and the Retomar | Encerrar actions in the footer (mobile)', async () => {
    windowWidth(390);
    getActive.mockResolvedValue(paused);
    const view = await renderForge();

    expect(view.getByText('Pausada')).toBeTruthy();
    expect(view.getByText('foco válido 10:28')).toBeTruthy();
    const footer = view.getByTestId('study-session-footer');
    expect(footer).toContainElement(view.getByRole('button', { name: 'Retomar sessão' }));
    expect(footer).toContainElement(view.getByRole('button', { name: 'Encerrar antecipadamente' }));
    view.unmount();
  });
});

describe('Em andamento (mobile)', () => {
  beforeEach(() => windowWidth(390));

  it('summarises Matéria, planned time and XP in three columns, with the notice and the fixed actions', async () => {
    const view = await renderForge();

    expect(view.getByText('Em andamento')).toBeTruthy();
    expectStat(view, 'study-session-strip-subject', 'Cálculo II', 'matéria');
    expectStat(view, 'study-session-strip-planned', '25 min', 'planejado');
    expectStat(view, 'study-session-strip-xp', '+250 XP', 'ao concluir');
    expect(view.getByText('Encerrar antes do fim registra apenas o foco válido até agora.')).toBeTruthy();
    const footer = view.getByTestId('study-session-footer');
    expect(footer).toContainElement(view.getByRole('button', { name: 'Pausar sessão' }));
    expect(view.getByText('Pausar')).toBeTruthy();
    expect(view.getByText('Encerrar')).toBeTruthy();
    view.unmount();
  });

  it('shows Foco livre as the kind and "Parar" with its warning', async () => {
    getActive.mockResolvedValue(free);
    const view = await renderForge();

    expectStat(view, 'study-session-strip-planned', 'Livre', 'tipo');
    expectStat(view, 'study-session-strip-xp', '+310 XP', 'até agora');
    expect(view.getByRole('button', { name: 'Parar e concluir' })).toBeTruthy();
    expect(view.getByText('Parar')).toBeTruthy();
    expect(view.getByText('Parar conclui o foco livre. Com menos de 5 minutos de foco, não concede XP.')).toBeTruthy();
    view.unmount();
  });

  it('keeps the footer buttons working', async () => {
    const view = await renderForge();
    const { pauseStudySession } = jest.requireMock('@/features/study-session/api') as { pauseStudySession: jest.Mock };
    pauseStudySession.mockResolvedValue(paused);

    await fireEvent.press(view.getByRole('button', { name: 'Pausar sessão' }));
    await waitFor(() => expect(pauseStudySession).toHaveBeenCalled());
    view.unmount();
  });
});

describe('XP and focus of the day', () => {
  it('estimates the XP at the server rate, nothing below five minutes', () => {
    expect(xpForFocus(1500)).toBe(250);
    expect(xpForFocus(1900)).toBe(310);
    expect(xpForFocus(299)).toBe(0);
    expect(xpForFocus(300)).toBe(50);
  });

  it('formats the focus of the day', () => {
    expect(formatFocusToday(4800)).toBe('1h 20min');
    expect(formatFocusToday(7200)).toBe('2h');
    expect(formatFocusToday(1500)).toBe('25 min');
  });
});

describe('"Enquanto isso" rules', () => {
  const { goalLine, levelLine } = jest.requireActual('@/features/study-session/meanwhile') as typeof import('@/features/study-session/meanwhile');

  it('counts the running session toward the goal and hides it once done', () => {
    expect(goalLine({ progress: 2, target: 4 })).toBe('Concluindo esta, falta 1 sessão para a meta de 4.');
    expect(goalLine({ progress: 1, target: 4 })).toBe('Concluindo esta, faltam 2 sessões para a meta de 4.');
    expect(goalLine({ progress: 3, target: 4 })).toBe('Concluindo esta, você bate a meta de 4.');
    expect(goalLine({ progress: 4, target: 4 })).toBeNull();
    expect(goalLine(undefined)).toBeNull();
  });

  it('names the XP missing for the next level', () => {
    expect(levelLine(user)).toBe('Faltam 1.050 XP para o nível 15.');
    expect(levelLine({ ...user, xpTotal: 10_000 })).toBeNull();
    expect(levelLine(undefined)).toBeNull();
  });
});
