import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { theme } from '@/design-system';
import { getMyProfile, getRecentStudySessions, getSessionMetrics, getWeekSummary, type UserProfile, type RecentStudySession, type SessionMetrics, type WeekSummary } from '@/features/dashboard/api';
import { getMilestones, getObjectives, type Milestone, type Milestones, type Objectives } from '@/features/chronicles/api';
import { getActiveRaid, getMyGuild, type ActiveRaid, type MyGuild } from '@/features/guild/api';
import { getCoinBalance } from '@/features/market/api';
import { getActiveStudySession, getFocusCycle, type FocusCycle, type StudySessionSnapshot } from '@/features/study-session/api';
import { dashboardKeys } from '@/features/dashboard/queries';
import { resetMockWindowDimensions, setMockWindowDimensions } from '../test-utils/window-dimensions';

jest.mock('react-native', () => require('../test-utils/window-dimensions').createReactNativeMock());

jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
  getSessionMetrics: jest.fn(),
  getWeekSummary: jest.fn(),
}));

jest.mock('@/features/chronicles/api', () => ({ getObjectives: jest.fn(), getMilestones: jest.fn() }));
jest.mock('@/features/guild/api', () => ({ getMyGuild: jest.fn(), getActiveRaid: jest.fn() }));
jest.mock('@/features/market/api', () => ({ getCoinBalance: jest.fn() }));
jest.mock('@/features/study-session/api', () => ({
  ...jest.requireActual('@/features/study-session/api'),
  getFocusCycle: jest.fn(),
  getActiveStudySession: jest.fn(),
}));

const profile: UserProfile = {
  id: 'user-1', email: 'wise@example.com', displayName: 'Aventureiro', planTier: 'free',
  level: 3, levelStartXp: 100, nextLevelXp: 200, xpTotal: 150, title: 'Aprendiz',
  equipped: [{ category: 'title', itemId: 'item-Aprendiz', name: 'Aprendiz' }],
};
const session: RecentStudySession = {
  id: 'session-1', subject: 'Matemática', mode: 'foco', state: 'completed', startedAt: '2026-09-16T18:00:00Z',
  endedAt: '2026-09-16T18:25:00Z', durationValidSeconds: 1500, xpAwarded: 25, discardedReason: null,
};
const cadenceStart = new Date('2026-07-24T00:00:00.000Z');
const metrics: SessionMetrics = {
  currentStreakDays: 4, longestStreakDays: 9, sessionsToday: 2, validSecondsToday: 3_600,
  cadence: { windowStart: '2026-07-24', windowEnd: '2026-09-17', days: Array.from({ length: 56 }, (_, index) => {
    const date = new Date(cadenceStart);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), sessionCount: index % 3, validSeconds: (index % 3) * 900, intensity: (index % 5) as 0 | 1 | 2 | 3 | 4 };
  }) },
};

const objectives = (target = 4, progress = 2): Objectives => ({
  daily: {
    date: '2026-09-17', renewsAt: '2026-09-18T03:00:00.000Z',
    items: [{ id: 'four-sessions', title: 'Conclua 4 sessões hoje', progress, target, coins: 15, completed: progress >= target }],
  },
  weekly: { weekStart: '2026-09-14', renewsAt: '2026-09-21T03:00:00.000Z', items: [] },
});
const weekSummary = (subjects: WeekSummary['subjects'] = []): WeekSummary => ({
  weekStart: '2026-09-14', weekEnd: '2026-09-20', today: '2026-09-17', validSeconds: 13_200, sessionCount: 6, xp: 300,
  days: [], subjects,
});
const withWeeklyMinutes = (progress: number, target: number): Objectives => {
  const base = objectives();
  return { ...base, weekly: { ...base.weekly, items: [{ id: 'weekly-focus', title: 'Foque na semana', progress, target, coins: 40, completed: progress >= target, unit: 'minutes' }] } };
};
const mockedWeek = getWeekSummary as jest.MockedFunction<typeof getWeekSummary>;
const mockedMilestones = getMilestones as jest.MockedFunction<typeof getMilestones>;
const mockedObjectives = getObjectives as jest.MockedFunction<typeof getObjectives>;
const mockedProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockedActivity = getRecentStudySessions as jest.MockedFunction<typeof getRecentStudySessions>;

function metaParts(sessionId: string): string[] {
  return String(screen.getByTestId(`dashboard-activity-meta-${sessionId}`).props.children).split(' · ');
}
const mockedCoins = getCoinBalance as jest.MockedFunction<typeof getCoinBalance>;
const mockedCycle = getFocusCycle as jest.MockedFunction<typeof getFocusCycle>;
const mockedActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const cycle = (completedInCycle = 2, nextBreak: FocusCycle['nextBreak'] = 'long'): FocusCycle => ({ completedInCycle, cycleLength: 4, nextBreak });
const activeSession = (overrides: Partial<StudySessionSnapshot> = {}): StudySessionSnapshot => ({
  id: 'active-1', kind: 'cycle', mode: 'solo', raidId: null, subject: 'Cálculo II', state: 'paused', plannedDurationSeconds: 1500,
  startedAt: '2026-09-17T12:00:00.000Z', runDeadlineAt: null, pausedAt: '2026-09-17T12:07:00.000Z', pausedTotalSeconds: 0,
  durationValidSeconds: 378, remainingSeconds: 1122, serverNow: '2026-09-17T12:07:00.000Z', version: 2, endedAt: null, xpAwarded: 0,
  terminalReason: null, discardedReason: null, canControl: true, receivedAtMs: Date.now(), ...overrides,
});
const mockedGuild = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const mockedRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;
const myGuild: MyGuild = { guild: { id: 'guild-1', name: 'Ordem dos Madrugadores', level: 3, memberCount: 5, leader: null }, role: 'member' };
const weekDays = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
const activeRaid = (overrides: Partial<ActiveRaid> = {}): ActiveRaid => ({
  id: 'raid-1', mission: { slug: 'devorador', name: 'O Devorador de Horas', description: 'Um dragão', imageUrl: null }, missionOwner: null,
  rewards: [], coins: 0, party: [], goalXp: 120_000, progressXp: 82_800, regeneratedXp: 0, healthXp: 37_200, furyPercent: 5, goalReachedAt: null,
  startsAt: '2026-10-05T03:00:00.000Z', endsAt: new Date(Date.now() + (3 * 24 + 14) * 3_600_000 + 60_000).toISOString(), status: 'active',
  weekDays, today: '2026-10-10', studyDays: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'], streak: 1,
  me: { participating: true, contributionXp: 600, position: 4 },
  lastHit: { userId: 'user-2', displayName: 'Lia', xp: 400, focusMinutes: 40, at: '2026-10-10T12:00:00.000Z' },
  ...overrides,
});
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;

async function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  mockedMetrics.mockResolvedValue(metrics);
  mockedObjectives.mockResolvedValue(objectives());
  mockedMilestones.mockResolvedValue({ earned: 0, total: 0, items: [] });
  mockedWeek.mockResolvedValue(weekSummary());
  mockedCoins.mockResolvedValue(1240);
  mockedCycle.mockResolvedValue(cycle());
  mockedActive.mockResolvedValue(null);
  mockedGuild.mockResolvedValue(null);
  mockedRaid.mockResolvedValue(null);
});

afterEach(() => {
  jest.clearAllMocks();
  resetMockWindowDimensions();
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
});

describe('DashboardScreen', () => {
  it('presents the prototype progression with a visible level percentage', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-progression')).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Progressão' })).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it.each(['ios', 'android'] as const)('has no refresh button on %s, where the user pulls down to refresh', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    const welcome = await screen.findByTestId('dashboard-profile');
    expect(within(welcome).queryByRole('button', { name: 'Atualizar dados' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Atualizar dados' })).toBeNull();
  });

  it('refreshes profile, activity and metrics when pulling down on iOS, showing progress until they settle', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    const isRefreshing = () => screen.getByTestId('dashboard-scroll').props.refreshControl.props.refreshing;
    expect(isRefreshing()).toBe(false);

    let resolveProfile!: (value: UserProfile) => void;
    let resolveActivity!: (value: RecentStudySession[]) => void;
    let resolveMetrics!: (value: SessionMetrics) => void;
    mockedProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    mockedMetrics.mockReturnValue(new Promise((resolve) => { resolveMetrics = resolve; }));
    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });

    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    expect(mockedMetrics).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(isRefreshing()).toBe(true));

    await act(async () => { resolveProfile(profile); resolveActivity([]); resolveMetrics(metrics); });
    await waitFor(() => expect(isRefreshing()).toBe(false));
  });

  it('keeps the refresh button on web, where there is no pull gesture', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    const welcome = await screen.findByTestId('dashboard-profile');
    expect(within(welcome).getByRole('button', { name: 'Atualizar dados' })).toBeTruthy();
    expect(screen.getByTestId('dashboard-scroll').props.refreshControl).toBeUndefined();
  });

  it('offers a direct focus action from Acampamento', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await screen.findByTestId('dashboard-profile');
    expect(await screen.findByRole('link', { name: 'Iniciar foco, 3 de 4' })).toBeTruthy();
  });

  describe('Raid card', () => {
    beforeEach(() => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
    });

    const raidCard = () => screen.findByTestId('dashboard-raid');

    it('shows the Missão, the Guild, the hours, the Fúria, the last Golpe, the time left and the place on desktop', async () => {
      setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid());
      await renderDashboard();

      const card = await raidCard();
      expect(within(card).getByText('O Devorador de Horas')).toBeTruthy();
      expect(within(card).getByText('Ordem dos Madrugadores')).toBeTruthy();
      expect(within(card).getByText('RAID')).toBeTruthy();
      expect(within(card).getByText('138h / 200h')).toBeTruthy();
      expect(within(card).getByTestId('dashboard-raid-bar')).toBeTruthy();
      expect(within(card).getByText('4 de 7 dias com estudo')).toBeTruthy();
      expect(within(card).getByText('O chefe recupera 5% da vida a cada dia sem estudo na guilda.')).toBeTruthy();
      expect(within(card).getByText('Último golpe: Lia · +400 XP · 40 min')).toBeTruthy();
      expect(within(card).getByText('3d 14h restantes · você: 4º')).toBeTruthy();
      expect(within(card).getByTestId('dashboard-raid-scene')).toBeTruthy();
      expect(within(card).getByRole('link', { name: 'Ver guilda' }).props.href).toBe('/guilda/raid');
      expect(within(screen.getByTestId('dashboard-side-column')).getByLabelText('Raid da guilda')).toBeTruthy();
      expect(screen.queryByText(/em preparação/)).toBeNull();
      expect(mockedRaid).toHaveBeenCalledWith('guild-1', expect.anything());
    });

    it('marks each day of the Fúria as Dia de estudo, missed, today or upcoming', async () => {
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid());
      await renderDashboard();

      const days = within(await screen.findByTestId('dashboard-raid-days'));
      expect(days.getAllByLabelText(/com estudo$/)).toHaveLength(4);
      expect(days.getByLabelText('quarta: com estudo')).toBeTruthy();
      expect(days.getByLabelText('quinta: sem estudo')).toBeTruthy();
      expect(days.getByLabelText('sábado: hoje, ainda sem estudo')).toBeTruthy();
      expect(days.getByLabelText('domingo: ainda não chegou')).toBeTruthy();
    });

    it('shows no position for who is not a Participant', async () => {
      setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid({ me: { participating: false, contributionXp: 0, position: null } }));
      await renderDashboard();

      const card = await raidCard();
      expect(within(card).getByText('3d 14h restantes')).toBeTruthy();
      expect(within(card).queryByText(/você:/)).toBeNull();
    });

    it('drops the last Golpe line when there is none', async () => {
      setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid({ lastHit: null }));
      await renderDashboard();

      const card = await raidCard();
      expect(within(card).queryByText(/Último golpe/)).toBeNull();
      expect(within(card).getByText('138h / 200h')).toBeTruthy();
    });

    it('leaves the minutes out of the last Golpe when the Study Session is gone', async () => {
      setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid({ lastHit: { userId: 'user-2', displayName: 'Lia', xp: 400, focusMinutes: null, at: '2026-10-10T12:00:00.000Z' } }));
      await renderDashboard();

      expect(await screen.findByText('Último golpe: Lia · +400 XP')).toBeTruthy();
    });

    it('is the left block of the mobile grid, with the compact hours, the short Fúria rule and the same structure as the Marco', async () => {
      setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid());
      mockedMilestones.mockResolvedValue({ earned: 0, total: 1, items: [{ id: 'c05e71c0-0000-4000-8000-000000000003', name: 'Madrugador', progress: 4, target: 5, earned: false }] });
      await renderDashboard();

      const card = await raidCard();
      expect(within(card).getByText('138/200h')).toBeTruthy();
      expect(within(card).getByText('O chefe recupera 5% da vida a cada dia sem estudo na guilda.')).toBeTruthy();
      expect(within(card).getByText('Último golpe: Lia · +400 XP · 40 min')).toBeTruthy();
      expect(within(card).getByLabelText('4 de 7 dias com estudo')).toBeTruthy();
      expect(within(card).getByText('3d 14h · você: 4º')).toBeTruthy();
      expect(within(card).getByRole('link', { name: 'Ver guilda' }).props.href).toBe('/guilda/raid');
      const grid = within(screen.getByTestId('dashboard-main-column')).getByTestId('dashboard-highlights');
      expect(grid.children.map((child) => (child as { props: { testID?: string } }).props.testID)).toEqual(['dashboard-raid', 'dashboard-milestone']);
      expect(StyleSheet.flatten(card.props.style).minHeight).toBe(StyleSheet.flatten(screen.getByTestId('dashboard-milestone').props.style).minHeight);
    });

    it('draws the scene of the Missão on the card, with its boss at the scene position', async () => {
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid({ mission: { slug: 'forja-dos-sabios', name: 'Forja dos Sábios', description: '', imageUrl: null } }));
      await renderDashboard();

      const frame = await screen.findByTestId('dashboard-raid-scene');
      await act(async () => { fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 64 } } }); });
      // ×2 on the 300px card; the Vulcão would sit at 103 × 36.
      expect(StyleSheet.flatten(within(frame).getByTestId('raid-scene-boss', { includeHiddenElements: true }).props.style)).toMatchObject({ left: 110 * 2, top: 20 * 2 });
    });

    it('draws the Vulcão do Devorador for a Missão without its own art, and keeps the scene still under reduced motion', async () => {
      const reduceMotion = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
      reduceMotion.mockResolvedValue(true);
      try {
        mockedGuild.mockResolvedValue(myGuild);
        mockedRaid.mockResolvedValue(activeRaid({ mission: { slug: 'missao-sem-arte', name: 'Missão nova', description: '', imageUrl: null } }));
        await renderDashboard();

        const frame = await screen.findByTestId('dashboard-raid-scene');
        await act(async () => { fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 64 } } }); });
        const scene = within(frame);
        expect(scene.getByTestId('raid-scene-background', { includeHiddenElements: true })).toBeTruthy();
        expect(scene.getByTestId('raid-scene-boss', { includeHiddenElements: true })).toBeTruthy();
        expect(screen.getByText('Missão nova')).toBeTruthy();
      } finally {
        reduceMotion.mockResolvedValue(false);
      }
    });

    it('says the Guild has no Raid this week, with a link to the Guilda', async () => {
      mockedGuild.mockResolvedValue(myGuild);
      await renderDashboard();

      const card = await screen.findByTestId('dashboard-raid-empty');
      expect(within(card).getByText('Ordem dos Madrugadores ainda não tem uma Raid nesta semana.')).toBeTruthy();
      expect(within(card).getByRole('link', { name: 'Ver guilda' }).props.href).toBe('/guilda');
    });

    it('invites a student without a Guild to look for or create one', async () => {
      await renderDashboard();

      const card = await screen.findByTestId('dashboard-raid-no-guild');
      expect(within(card).getByRole('link', { name: 'Procurar ou criar uma Guild' }).props.href).toBe('/guilda');
      expect(mockedRaid).not.toHaveBeenCalled();
    });

    it('shows its loading state while the Guild and the Raid load', async () => {
      mockedGuild.mockReturnValue(new Promise(() => {}));
      await renderDashboard();

      expect(await screen.findByText('Carregando a Raid…')).toBeTruthy();
      expect(screen.getByTestId('dashboard-progression')).toBeTruthy();
    });

    it('retries only the Guild query when it fails', async () => {
      mockedGuild.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid());
      await renderDashboard();

      const error = await screen.findByTestId('dashboard-raid-error');
      const milestoneCalls = mockedMilestones.mock.calls.length;
      await act(async () => { fireEvent.press(within(error).getByRole('button', { name: 'Tentar novamente' })); });

      expect(await raidCard()).toBeTruthy();
      expect(mockedGuild).toHaveBeenCalledTimes(2);
      expect(mockedMilestones).toHaveBeenCalledTimes(milestoneCalls);
    });

    it('retries only the Raid query when it fails', async () => {
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(activeRaid());
      await renderDashboard();

      const error = await screen.findByTestId('dashboard-raid-error');
      await act(async () => { fireEvent.press(within(error).getByRole('button', { name: 'Tentar novamente' })); });

      expect(await raidCard()).toBeTruthy();
      expect(mockedRaid).toHaveBeenCalledTimes(2);
      expect(mockedGuild).toHaveBeenCalledTimes(1);
    });

    it('refreshes the Guild and the Raid with "Atualizar" and reports a partial failure', async () => {
      mockedGuild.mockResolvedValue(myGuild);
      mockedRaid.mockResolvedValue(activeRaid());
      await renderDashboard();
      await raidCard();
      await screen.findByRole('button', { name: 'Atualizar dados' });
      mockedRaid.mockRejectedValue(new Error('boom'));

      await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });

      await waitFor(() => expect(mockedRaid).toHaveBeenCalledTimes(2));
      expect(mockedGuild).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('Alguns dados não foram atualizados.')).toBeTruthy();
    });
  });

  it('names the streak card Constância and shows the record', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await screen.findByTestId('dashboard-constancy');
    expect(screen.getByRole('header', { name: 'Constância' })).toBeTruthy();
    expect(screen.queryByText('Sequência atual')).toBeNull();
    expect(screen.getByText('Recorde: 9 dias')).toBeTruthy();
  });

  it('uses the AppShell safe-area contract and keeps the loading progressbar queryable', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();

    expect(screen.getByTestId('dashboard-safe-area').props.edges).toEqual({ top: 'off', right: 'off', bottom: 'off', left: 'off' });
    expect(screen.getByRole('progressbar', { name: 'Carregando seu painel', busy: true })).toBeTruthy();
  });

  it('exposes loading as a busy indeterminate progressbar', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();

    expect(screen.getByRole('progressbar', { name: 'Carregando seu painel', busy: true }).props.accessibilityValue)
      .toEqual({ min: 0, max: 100 });
  });

  it.each(['ios', 'android'] as const)('keeps the dashboard stacked on %s at wide widths', async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'column' })]));
  });

  it('keeps card content padded and columns shrinkable', async () => {
    setMockWindowDimensions({ width: 320, height: 700, fontScale: 1.4 });
    mockedProfile.mockResolvedValue({ ...profile, displayName: 'Aventureiro com um nome muito comprido para a viewport' });
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-profile-content')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile-identity').props.style).toEqual(expect.objectContaining({ flexShrink: 1, minWidth: 0 }));
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '100%', flexDirection: 'column' })]));
    expect(screen.getByTestId('dashboard-main-column').props.style).toEqual(expect.objectContaining({ minWidth: 0 }));
    expect(screen.getByTestId('dashboard-side-column').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ minWidth: 0 })]));
    expect(screen.queryByText('Aprendiz')).toBeTruthy();
  });

  it.each([320, 390])('keeps long dashboard content readable at %dpx with enlarged font settings', async (width) => {
    const longDisplayName = 'Aventureiro com um nome deliberadamente longo para testar quebra de linha';
    const longTitle = 'Guardião das bibliotecas e do raciocínio paciente';
    const longSubject = 'Matemática aplicada, raciocínio lógico e resolução de problemas';
    setMockWindowDimensions({ width, height: 844, fontScale: 2 });
    mockedProfile.mockResolvedValue({ ...profile, displayName: longDisplayName, title: longTitle });
    mockedActivity.mockResolvedValue([{ ...session, subject: longSubject, durationValidSeconds: 45, discardedReason: 'too_short' }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByRole('header', { name: `Boas-vindas, ${longDisplayName}` })).toBeTruthy();
    expect(screen.getByText(longTitle)).toBeTruthy();
    expect(screen.getByText(longSubject)).toBeTruthy();
    expect(screen.getByText(/· 45 s$/)).toBeTruthy();
    expect(screen.getByText('Sessão não contabilizada')).toBeTruthy();
    expect(screen.getByTestId(`dashboard-activity-title-${session.id}`).props.allowFontScaling).toBe(true);
  });

  it('exposes each long activity item as one complete accessible announcement', async () => {
    const longSession = {
      ...session,
      subject: 'Matemática aplicada e raciocínio lógico avançado',
      discardedReason: 'too_short',
    };
    mockedProfile.mockResolvedValue({ ...profile, title: null });
    mockedActivity.mockResolvedValue([longSession]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.queryByText('Aprendiz')).toBeNull();
    expect(screen.getByLabelText(/Matemática aplicada e raciocínio lógico avançado.*Concluída.*foco.*25 min.*25 XP.*Sessão não contabilizada/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 4', value: { min: 100, max: 200, now: 150 } })).toBeTruthy();
  });

  it('keeps partial errors visible without putting the generic summary in the live region', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValue(new Error('activity offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-partial-error').props['aria-live']).toBe('off');
    expect(screen.getByTestId('dashboard-status').props['aria-live']).toBe('polite');
    expect(screen.getByTestId('dashboard-status').props['aria-atomic']).toBe(true);
  });

  it('uses named regions and preserves semantic card order on narrow screens', async () => {
    setMockWindowDimensions({ width: 390, height: 844, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([session]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText('Resumo de perfil')).toBeTruthy());
    await screen.findByTestId('dashboard-objectives');
    expect(screen.getByLabelText('Progressão')).toBeTruthy();
    expect(screen.getByLabelText('Atividade recente')).toBeTruthy();
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'column' })]));
    expect(screen.getByTestId('dashboard-main-column').children.filter((child) => typeof child !== 'string').map((child) => 'props' in child ? child.props.testID : undefined)).toEqual([
      'dashboard-profile',
      'dashboard-progression',
      'dashboard-metrics',
      'dashboard-objectives',
      'dashboard-highlights',
      'dashboard-cadence',
    ]);
  });

  it('uses two columns on wide web screens while keeping activity in the side column', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([session]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'row' })]));
    expect(screen.getByTestId('dashboard-main-column').props.style).toEqual(expect.objectContaining({ flex: 1 }));
    expect(screen.getByTestId('dashboard-side-column').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 320 })]));
  });

  it('shows a blocking profile error and retries the profile request', async () => {
    mockedProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByText('Painel indisponível')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-profile')).toBeTruthy());
    expect(mockedProfile).toHaveBeenCalledTimes(2);
  });

  it('renders profile progress and recent activity, including discarded reason', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([{ ...session, discardedReason: 'too_short' }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByText('Boas-vindas, Aventureiro')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso para o nível 4' }).props.accessibilityValue).toEqual({ min: 100, max: 200, now: 150 });
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Sessão não contabilizada')).toBeTruthy();
  });

  it('shows the subject as title and the session state in the details line', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([session]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(metaParts('session-1')).toEqual(['Concluída', 'foco', expect.any(String), '25 min']);
    expect(screen.queryByText('Sem matéria')).toBeNull();
  });

  it('shows a discreet "Sem matéria" title for a session without subject, keeping the state in the details', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([{
      ...session, subject: null, state: 'cancelled', durationValidSeconds: 299, xpAwarded: 0,
    }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByText('Sem matéria')).toBeTruthy();
    expect(screen.queryByText('Cancelada')).toBeNull();
    expect(metaParts('session-1')).toEqual(['Cancelada', 'foco', expect.any(String), '4 min']);
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.getByLabelText(/Sem matéria.*Cancelada/)).toBeTruthy();
  });

  it('keeps the guild indication beside the subject or "Sem matéria"', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([
      { ...session, id: 's1', mode: 'guild' },
      { ...session, id: 's2', mode: 'guild', subject: null },
    ]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByTestId('dashboard-activity-title-s1')).toHaveTextContent('Matemática · guilda');
    expect(screen.getByTestId('dashboard-activity-title-s2')).toHaveTextContent('Sem matéria · guilda');
  });

  it('applies the discreet style only to "Sem matéria", not to the guild indication', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([
      { ...session, id: 's1', subject: null, mode: 'guild' },
      { ...session, id: 's2', subject: 'Física', mode: 'guild' },
    ]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    const noSubject = StyleSheet.flatten(screen.getByText('Sem matéria').props.style);
    const subject = StyleSheet.flatten(screen.getByTestId('dashboard-activity-title-s2').props.style);
    expect(noSubject?.fontStyle).toBeUndefined();
    expect(noSubject?.fontFamily).toBe('Inter-Regular');
    expect(noSubject?.color).toBe(theme.color.textTertiary);
    expect(subject?.fontFamily).toBe('Inter-Medium');
    expect(subject?.color).toBe(theme.color.textPrimary);
    const guildMarks = screen.getAllByText(/· guilda$/);
    expect(guildMarks).toHaveLength(2);
    guildMarks.forEach((mark) => expect(StyleSheet.flatten(mark.props.style)?.color).toBe(theme.color.textPrimary));
  });

  it('clamps a long subject title to two lines with a tail ellipsis', async () => {
    const subject = 'Cálculo diferencial e integral aplicado a problemas de otimização e modelagem';
    expect(subject).toHaveLength(77);
    const eighty = `${subject}...`;
    expect(eighty).toHaveLength(80);
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([{ ...session, subject: eighty }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    const title = screen.getByTestId(`dashboard-activity-title-${session.id}`);
    expect(title.props.numberOfLines).toBe(2);
    expect(title.props.ellipsizeMode).toBe('tail');
  });

  it('treats empty or whitespace-only subjects as "Sem matéria"', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([
      { ...session, id: 's1', subject: '' },
      { ...session, id: 's2', subject: '   ' },
    ]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getAllByText('Sem matéria')).toHaveLength(2);
  });

  it('keeps an 80-character subject readable and announced with the guild mode', async () => {
    const subject = 'M'.repeat(80);
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([{ ...session, subject, mode: 'guild' }]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());
    expect(screen.getByTestId(`dashboard-activity-title-${session.id}`)).toHaveTextContent(`${subject} · guilda`);
    expect(metaParts('session-1')).toEqual(['Concluída', 'guilda', expect.any(String), '25 min']);
    expect(screen.getByLabelText(new RegExp(`${subject}.*Concluída.*guilda.*25 min`))).toBeTruthy();
  });

  it('follows the target of the "Conclua 4 sessões hoje" Objetivo set on the server', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedObjectives.mockResolvedValue(objectives(6, 3));
    await renderDashboard();

    expect(await screen.findByText('3 / 6')).toBeTruthy();
    expect(screen.getByLabelText(/Sessões hoje: 3 de 6/)).toBeTruthy();
  });

  it('shows only the session count while the Objetivo cannot be loaded', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedObjectives.mockRejectedValue(new Error('offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText('Sessões hoje: 2')).toBeTruthy());
    expect(screen.queryByText('2 / 4')).toBeNull();
  });

  it('renders the streak metrics and 56-cell cadence card with accessible summaries', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-cadence')).toBeTruthy());
    expect(screen.getByText('4 dias')).toBeTruthy();
    expect(await screen.findByText('2 / 4')).toBeTruthy();
    expect(screen.getByText('60 min de foco válido')).toBeTruthy();
    expect(screen.getByText(/Período: 24\/07 a 17\/09/)).toBeTruthy();
    expect(screen.getAllByTestId(/^dashboard-cadence-cell-/)).toHaveLength(56);
    expect(screen.getByTestId('dashboard-cadence-cell-0').props).toEqual(expect.objectContaining({ accessible: true, accessibilityRole: 'image', role: 'img', 'aria-label': expect.stringContaining('24/07') }));
    expect(screen.getByTestId('dashboard-cadence-cell-55').props['aria-label']).toContain('17/09');
  });

  it('keeps metrics loading and error states independent from profile and activity', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedMetrics.mockRejectedValue(new Error('metrics offline'));
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile')).toBeTruthy();
    expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy();
  });

  it('adds no empty status row to the metrics grid, which would double the gap before the next card', async () => {
    setMockWindowDimensions({ width: 375, height: 812, fontScale: 1 });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await screen.findByTestId('dashboard-sessions');

    expect(screen.getByTestId('dashboard-metrics').children).toHaveLength(3);
    expect(screen.queryByTestId('dashboard-metrics-status')).toBeNull();
  });

  it('shows the metrics status on its own full-width row while refreshing', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await screen.findByTestId('dashboard-sessions');

    mockedMetrics.mockReturnValue(new Promise(() => undefined));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });

    const status = await screen.findByTestId('dashboard-metrics-status');
    expect(within(status).getByTestId('dashboard-metrics-refreshing')).toBeTruthy();
    expect(StyleSheet.flatten(status.props.style)).toMatchObject({ flexBasis: '100%' });
  });

  it('keeps cached metrics visible when a background refresh fails', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedMetrics.mockResolvedValueOnce(metrics);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics')).toBeTruthy());

    mockedMetrics.mockRejectedValueOnce(new Error('metrics offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-metrics-refresh-error')).toBeTruthy());
    expect(screen.getByText('4 dias')).toBeTruthy();
    expect(screen.getByText('Métricas desatualizadas')).toBeTruthy();
  });

  it('shows empty activity and keeps profile visible when activity fails after profile succeeds', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValue(new Error('activity offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-profile')).toBeTruthy();
    expect(screen.getByText('Alguns dados não foram atualizados.')).toBeTruthy();
    mockedActivity.mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
  });

  it('keeps cached activity and offers retry when a background refresh fails', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([session]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());

    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-refresh-error')).toBeTruthy());
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });

  it('announces a cached profile refresh failure and keeps the previous profile visible', async () => {
    mockedProfile.mockResolvedValueOnce(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-profile')).toBeTruthy());

    mockedProfile.mockRejectedValueOnce(new Error('profile offline'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });
    await waitFor(() => expect(screen.getByTestId('dashboard-profile-refresh-error')).toBeTruthy());
    expect(screen.getByText('Boas-vindas, Aventureiro')).toBeTruthy();
    expect(screen.getByText('Progresso desatualizado')).toBeTruthy();
    expect(screen.getByTestId('dashboard-partial-error').props['aria-live']).toBe('off');
  });

  it('single-flights repeated activity retries', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-error')).toBeTruthy());

    let resolveRetry!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRetry = resolve; }));
    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });
    await act(() => { fireEvent.press(retryButton); });
    await act(() => { fireEvent.press(retryButton); });
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    await act(async () => { resolveRetry([]); });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
  });

  it('announces success after an isolated activity retry on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([session]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity')).toBeTruthy());

    mockedActivity.mockRejectedValueOnce(new Error('activity offline'));
    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-refresh-error')).toBeTruthy());
    announce.mockClear();

    let resolveRetry!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRetry = resolve; }));
    await act(() => { fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' })); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Atualizando dados', { queue: true }));
    await act(async () => { resolveRetry([]); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Dados atualizados', { queue: true }));
    expect(announce.mock.calls.filter(([message]) => message === 'Dados atualizados')).toHaveLength(1);
    announce.mockRestore();
  });

  it('shows success after an external activity refetch completes', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValueOnce([]);
    const { client } = await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    let resolveRefetch!: (value: RecentStudySession[]) => void;
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveRefetch = resolve; }));
    await act(() => { void client.invalidateQueries({ queryKey: dashboardKeys.recentActivity() }); });
    await waitFor(() => expect(screen.getByText('Atualizando dados')).toBeTruthy());
    await act(async () => { resolveRefetch([]); });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
    client.clear();
  });

  it('announces dashboard status changes once on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    announce.mockClear();

    let resolveProfile!: (value: UserProfile) => void;
    let resolveActivity!: (value: RecentStudySession[]) => void;
    mockedProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Atualizando dados', { queue: true }));
    await act(async () => { resolveProfile(profile); resolveActivity([]); });
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Dados atualizados', { queue: true }));
    expect(announce.mock.calls.filter(([message]) => message === 'Atualizando dados')).toHaveLength(1);
    announce.mockRestore();
  });

  it('does not start duplicate requests while a manual refresh is pending', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    let resolveProfile!: (value: UserProfile) => void;
    let resolveActivity!: (value: RecentStudySession[]) => void;
    mockedProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockedActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveProfile(profile);
      resolveActivity([]);
    });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
  });

  it('displays loading state before the initial profile response', async () => {
    mockedProfile.mockReturnValue(new Promise(() => undefined));
    mockedActivity.mockReturnValue(new Promise(() => undefined));
    await renderDashboard();
    expect(screen.getByText('Carregando seu painel…')).toBeTruthy();
    expect(screen.getByTestId('dashboard-loading').props.accessibilityState).toEqual({ busy: true });
  });

  it('exposes a web refresh action and announces background refresh', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    const { client } = await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    let resolveProfileRefresh!: (value: UserProfile) => void;
    let resolveActivityRefresh!: (value: RecentStudySession[]) => void;
    const profileRefresh = new Promise<UserProfile>((resolve) => { resolveProfileRefresh = resolve; });
    const activityRefresh = new Promise<RecentStudySession[]>((resolve) => { resolveActivityRefresh = resolve; });
    mockedProfile.mockReturnValue(profileRefresh);
    mockedActivity.mockReturnValue(activityRefresh);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByText('Atualizando dados')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Atualizar dados' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await act(async () => {
      resolveProfileRefresh(profile);
      resolveActivityRefresh([]);
    });
    client.clear();
  });

  it('announces successful manual refresh completion', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });
    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
  });

  it('refreshes profile, activity and metrics from the web "Atualizar dados" button', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    await waitFor(() => expect(mockedMetrics).toHaveBeenCalledTimes(1));
    expect(mockedProfile).toHaveBeenCalledTimes(1);
    expect(mockedActivity).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });

    await waitFor(() => expect(screen.getByText('Dados atualizados')).toBeTruthy());
    expect(mockedProfile).toHaveBeenCalledTimes(2);
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    expect(mockedMetrics).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('dashboard-partial-error')).toBeNull();
  });

  it.each([
    ['profile', mockedProfile],
    ['activity', mockedActivity],
    ['metrics', mockedMetrics],
  ] as const)('shows the partial failure message when the %s refresh fails', async (_name, failing) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => expect(screen.getByTestId('dashboard-activity-empty')).toBeTruthy());
    await waitFor(() => expect(mockedMetrics).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('dashboard-partial-error')).toBeNull();

    (failing as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' }));
    });

    await waitFor(() => expect(screen.getByTestId('dashboard-partial-error')).toBeTruthy());
    expect(screen.getByText('Alguns dados não foram atualizados.')).toBeTruthy();
  });

  describe('Hoje e Progressão', () => {
    it('shows four session markers, filled for the sessions done today', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      await renderDashboard();

      await screen.findByText('2 / 4');
      const markers = screen.getAllByTestId(/^dashboard-sessions-marker-/, { includeHiddenElements: true });
      expect(markers).toHaveLength(4);
      const filled = markers.map((marker) => StyleSheet.flatten(marker.props.style).backgroundColor === theme.color.accentPrimary);
      expect(filled).toEqual([true, true, false, false]);
    });

    it('draws one marker per session of the Objetivo target, filled by its progress', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      mockedObjectives.mockResolvedValue(objectives(6, 3));
      await renderDashboard();

      await screen.findByText('3 / 6');
      const markers = screen.getAllByTestId(/^dashboard-sessions-marker-/, { includeHiddenElements: true });
      expect(markers.map((marker) => StyleSheet.flatten(marker.props.style).backgroundColor === theme.color.accentPrimary)).toEqual([true, true, true, false, false, false]);
    });

    it('shows the weekly minutes Objetivo under the valid focus of today', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      mockedObjectives.mockResolvedValue(withWeeklyMinutes(220, 300));
      await renderDashboard();

      expect(await screen.findByText('Semana: 3h 40min de 5h')).toBeTruthy();
      expect(screen.getByText('1h')).toBeTruthy();
    });

    it('falls back to the old text without a weekly minutes Objetivo or when /objectives fails', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      const { unmount } = await renderDashboard();
      expect(await screen.findByText('60 min de foco válido')).toBeTruthy();
      expect(screen.queryByText(/^Semana:/)).toBeNull();
      await unmount();

      mockedObjectives.mockRejectedValue(new Error('offline'));
      await renderDashboard();
      expect(await screen.findByText('60 min de foco válido')).toBeTruthy();
    });

    it('lists up to three subjects of the week in the server order, as chips on desktop', async () => {
      setMockWindowDimensions({ width: 1280, height: 800, fontScale: 1 });
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      mockedWeek.mockResolvedValue(weekSummary([
        { subject: 'Cálculo II', validSeconds: 6_000 }, { subject: 'Algoritmos e Grafos', validSeconds: 4_200 },
        { subject: 'Redação Dissertativa', validSeconds: 3_000 }, { subject: 'Física', validSeconds: 600 },
      ]));
      await renderDashboard();

      const row = await screen.findByTestId('dashboard-week-subjects');
      expect(within(row).getAllByTestId('dashboard-week-subject').map((chip) => within(chip).getAllByText(/./).map((node) => node.props.children))).toEqual([
        ['Cálculo II', '1h 40min'], ['Algoritmos e Grafos', '1h 10min'], ['Redação Dissertativa', '50min'],
      ]);
      expect(within(row).queryByText('Física')).toBeNull();
      expect(screen.queryByTestId('dashboard-week-subjects-scroll')).toBeNull();
    });

    it('scrolls the subjects horizontally on mobile', async () => {
      setMockWindowDimensions({ width: 375, height: 812, fontScale: 1 });
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      mockedWeek.mockResolvedValue(weekSummary([{ subject: 'Cálculo II', validSeconds: 6_000 }]));
      await renderDashboard();

      const scroll = await screen.findByTestId('dashboard-week-subjects-scroll');
      expect(scroll.props.horizontal).toBe(true);
    });

    it('hides the subjects row for an empty list and when the week summary fails, keeping the rest', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      const { unmount } = await renderDashboard();
      await screen.findByTestId('dashboard-progression');
      await waitFor(() => expect(mockedWeek).toHaveBeenCalled());
      expect(screen.queryByTestId('dashboard-week-subjects')).toBeNull();
      await unmount();

      mockedWeek.mockRejectedValue(new Error('week offline'));
      await renderDashboard();
      expect(await screen.findByTestId('dashboard-partial-error')).toBeTruthy();
      expect(screen.queryByTestId('dashboard-week-subjects')).toBeNull();
      expect(screen.getByTestId('dashboard-progression')).toBeTruthy();
      expect(screen.getByTestId('dashboard-metrics')).toBeTruthy();
    });

    it('refreshes the week summary with "Atualizar"', async () => {
      mockedProfile.mockResolvedValue(profile);
      mockedActivity.mockResolvedValue([]);
      await renderDashboard();
      await screen.findByTestId('dashboard-sessions');
      await waitFor(() => expect(mockedWeek).toHaveBeenCalledTimes(1));

      await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });

      await waitFor(() => expect(mockedWeek).toHaveBeenCalledTimes(2));
    });
  });
});

describe('DashboardScreen header', () => {
  beforeEach(() => {
    mockedProfile.mockResolvedValue({
      ...profile,
      equipped: [
        { category: 'title', itemId: 'item-Aprendiz', name: 'Aprendiz' },
        { category: 'weapon', itemId: 'weapon-1', name: 'Espada' },
      ],
    });
    mockedActivity.mockResolvedValue([]);
  });

  it('draws the Herói in the header, decorative for screen readers', async () => {
    await renderDashboard();

    const hero = await screen.findByTestId('dashboard-hero');
    expect(within(hero).getByTestId('character-hero-layer-body', { includeHiddenElements: true })).toBeTruthy();
    expect(within(hero).getByTestId('character-hero-layer-avatar', { includeHiddenElements: true })).toBeTruthy();
    expect(within(hero).getByTestId('character-hero-layer-weapon', { includeHiddenElements: true })).toBeTruthy();
    expect(within(hero).queryByTestId('character-hero-layer-accessory', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('dashboard-hero-sprite', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
  });

  it('shows the Moedas balance as a link to the Mercado, read as "N Moedas"', async () => {
    await renderDashboard();

    const badge = await screen.findByRole('link', { name: '1.240 Moedas' });
    expect(within(badge).getByText('1.240')).toBeTruthy();
    expect(badge.props.href).toBe('/mercado');
  });

  it('reads one Moeda in the singular', async () => {
    mockedCoins.mockResolvedValue(1);
    await renderDashboard();

    expect(await screen.findByRole('link', { name: '1 Moeda' })).toBeTruthy();
  });

  it('numbers the focus of the Ciclo on the desktop button', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    await renderDashboard();

    const action = await screen.findByRole('link', { name: 'Iniciar foco, 3 de 4' });
    expect(within(action).getByText('Iniciar foco')).toBeTruthy();
    expect(within(action).getByText('· 3/4')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-focus-footer')).toBeNull();
  });

  it('puts the Ciclo markers and caption above the fixed button on mobile', async () => {
    setMockWindowDimensions({ width: 390, height: 844, fontScale: 1 });
    mockedCycle.mockResolvedValue(cycle(2, 'long'));
    await renderDashboard();

    const footer = await screen.findByTestId('dashboard-focus-footer');
    await waitFor(() => expect(within(footer).getByTestId('dashboard-cycle-caption')).toBeTruthy());
    expect(within(footer).getByText('foco 3 de 4 · depois, pausa longa')).toBeTruthy();
    expect(within(footer).getAllByTestId('dashboard-cycle-marker-done')).toHaveLength(2);
    expect(within(footer).getAllByTestId('dashboard-cycle-marker-next')).toHaveLength(1);
    expect(within(footer).getAllByTestId('dashboard-cycle-marker-pending')).toHaveLength(1);
    expect(within(footer).getByRole('link', { name: /^Iniciar foco/ })).toBeTruthy();
  });

  it('turns the button into "Retomar foco" with the Matéria and the time left of a paused session', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    mockedActive.mockResolvedValue(activeSession());
    await renderDashboard();

    const action = await screen.findByRole('link', { name: 'Retomar foco, Cálculo II, pausada, 18:42 restantes' });
    expect(within(action).getByText('Retomar foco')).toBeTruthy();
    expect(within(action).getByText('· Cálculo II · 18:42')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Iniciar foco/ })).toBeNull();
  });

  it('describes the active session above the fixed button on mobile', async () => {
    setMockWindowDimensions({ width: 390, height: 844, fontScale: 1 });
    mockedActive.mockResolvedValue(activeSession());
    await renderDashboard();

    const footer = await screen.findByTestId('dashboard-focus-footer');
    await waitFor(() => expect(within(footer).getByText('Cálculo II · pausada · 18:42 restantes')).toBeTruthy());
    expect(within(footer).getByRole('link', { name: 'Retomar foco, Cálculo II, pausada, 18:42 restantes' })).toBeTruthy();
  });

  it('shows the elapsed time and "Sem matéria" of a Foco livre', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    mockedActive.mockResolvedValue(activeSession({
      kind: 'free', subject: null, plannedDurationSeconds: null, state: 'paused', durationValidSeconds: 754, remainingSeconds: 0,
    }));
    await renderDashboard();

    expect(await screen.findByRole('link', { name: 'Retomar foco, Sem matéria, pausada, 12:34 decorridos' })).toBeTruthy();
  });

  it('keeps the screen whole when the Moedas balance fails, hiding only the badge', async () => {
    mockedCoins.mockRejectedValue(new Error('offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-partial-error')).toBeTruthy());
    expect(screen.queryByTestId('dashboard-coins')).toBeNull();
    expect(screen.getByRole('link', { name: 'Iniciar foco, 3 de 4' })).toBeTruthy();
    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
  });

  it('says only "Iniciar foco" when the Ciclo fails, without markers on mobile', async () => {
    setMockWindowDimensions({ width: 390, height: 844, fontScale: 1 });
    mockedCycle.mockRejectedValue(new Error('offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-partial-error')).toBeTruthy());
    const footer = screen.getByTestId('dashboard-focus-footer');
    expect(within(footer).getByRole('link', { name: 'Iniciar foco' })).toBeTruthy();
    expect(within(footer).queryByTestId('dashboard-cycle')).toBeNull();
    expect(screen.getByTestId('dashboard-coins')).toBeTruthy();
  });

  it('offers "Iniciar foco" with the Ciclo when the active session cannot load', async () => {
    mockedActive.mockRejectedValue(new Error('offline'));
    await renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-partial-error')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Iniciar foco, 3 de 4' })).toBeTruthy();
    expect(screen.getByTestId('dashboard-coins')).toBeTruthy();
  });

  it('refreshes the balance, the Ciclo and the active session with "Atualizar"', async () => {
    await renderDashboard();
    await screen.findByRole('button', { name: 'Atualizar dados' });
    await waitFor(() => expect(mockedCoins).toHaveBeenCalledTimes(1));

    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });

    await waitFor(() => {
      expect(mockedCoins).toHaveBeenCalledTimes(2);
      expect(mockedCycle).toHaveBeenCalledTimes(2);
      expect(mockedActive).toHaveBeenCalledTimes(2);
    });
  });

  it('wraps a long Título onto two lines instead of letting the Moedas badge cut it', async () => {
    mockedProfile.mockResolvedValue({ ...profile, title: 'Guardião das bibliotecas e do raciocínio paciente' });
    await renderDashboard();

    const title = await screen.findByText('Guardião das bibliotecas e do raciocínio paciente');
    expect(title.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('dashboard-coins').props.style).flexShrink).toBe(0);
  });
});

describe('DashboardScreen Objetivos de hoje and Próximo Marco', () => {
  const dailyObjectives = (): Objectives => ({
    daily: {
      date: '2026-09-17', renewsAt: new Date(Date.now() + (7 * 60 + 12) * 60_000 + 30_000).toISOString(),
      items: [
        { id: 'one-session', title: 'Conclua 1 sessão de foco', progress: 1, target: 1, coins: 5, completed: true },
        { id: 'four-sessions', title: 'Conclua 4 sessões hoje', progress: 2, target: 4, coins: 15, completed: false },
        { id: 'fifty-minutes', title: 'Faça uma sessão de 50 minutos', progress: 0, target: 1, coins: 10, completed: false },
      ],
    },
    weekly: { weekStart: '2026-09-14', renewsAt: '2026-09-21T03:00:00.000Z', items: [] },
  });
  const milestone = (id: string, name: string, progress: number, target: number, earned = false): Milestone => ({ id, name, progress, target, earned });
  const milestones = (items: Milestone[]): Milestones => ({ earned: items.filter(({ earned }) => earned).length, total: items.length, items });
  const MADRUGADOR = 'c05e71c0-0000-4000-8000-000000000003';
  const CEM_SESSOES = 'c05e71c0-0000-4000-8000-000000000006';

  beforeEach(() => {
    // The desktop layout and the "Atualizar" button are web only.
    Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    mockedObjectives.mockResolvedValue(dailyObjectives());
  });

  it('lists the daily Objetivos in the server order with count, bar and Moedas, the met one set apart', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    await renderDashboard();

    const region = await screen.findByLabelText('Objetivos de hoje');
    const rows = within(region).getAllByTestId(/^dashboard-objective-(?!.*-bar)[a-z-]+$/);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Conclua 1 sessão de foco. Cumprido. 5 Moedas.',
      'Conclua 4 sessões hoje. 2 de 4. 15 Moedas.',
      'Faça uma sessão de 50 minutos. 0 de 1. 10 Moedas.',
    ]);
    expect(within(region).getByText('2/4')).toBeTruthy();
    expect(StyleSheet.flatten(within(region).getByText('Conclua 1 sessão de foco').props.style).textDecorationLine).toBe('line-through');
    expect(StyleSheet.flatten(within(region).getByText('Conclua 4 sessões hoje').props.style).textDecorationLine).toBeUndefined();
    expect(screen.getByTestId('dashboard-objective-one-session-bar').props['aria-valuenow']).toBe(1);
  });

  it('counts the met Objetivos and the time left to the renewal', async () => {
    await renderDashboard();

    expect((await screen.findByTestId('dashboard-objectives-renewal')).props.children).toBe('1 de 3 · renova em 7h 12min');
  });

  it('places Objetivos de hoje in the main column on desktop, one row per Objetivo', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    await renderDashboard();

    expect(within(await screen.findByTestId('dashboard-main-column')).getByLabelText('Objetivos de hoje')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-objectives-carousel')).toBeNull();
  });

  it('shows the Objetivos as a horizontal carousel of blocks on mobile', async () => {
    setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
    await renderDashboard();

    const carousel = await screen.findByTestId('dashboard-objectives-carousel');
    expect(carousel.props.horizontal).toBe(true);
    expect(within(carousel).getAllByTestId(/^dashboard-objective-(?!.*-bar)[a-z-]+$/)).toHaveLength(3);
  });

  it('shows an empty Objetivos card when the server sends none', async () => {
    mockedObjectives.mockResolvedValue({ ...dailyObjectives(), daily: { ...dailyObjectives().daily, items: [] } });
    await renderDashboard();

    expect(await screen.findByTestId('dashboard-objectives-empty')).toBeTruthy();
    expect(screen.getByText('Nenhum Objetivo para hoje.')).toBeTruthy();
  });

  it('isolates an Objetivos failure and retries only its own query', async () => {
    mockedObjectives.mockRejectedValueOnce(new Error('boom'));
    mockedMilestones.mockResolvedValue(milestones([milestone(MADRUGADOR, 'Madrugador', 4, 5)]));
    await renderDashboard();

    const error = await screen.findByTestId('dashboard-objectives-error');
    expect(screen.getByTestId('dashboard-milestone')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Progressão' })).toBeTruthy();
    const milestoneCalls = mockedMilestones.mock.calls.length;
    const objectivesCalls = mockedObjectives.mock.calls.length;

    await act(async () => { fireEvent.press(within(error).getByRole('button', { name: 'Tentar novamente' })); });

    expect(await screen.findByTestId('dashboard-objectives')).toBeTruthy();
    expect(mockedObjectives).toHaveBeenCalledTimes(objectivesCalls + 1);
    expect(mockedMilestones).toHaveBeenCalledTimes(milestoneCalls);
  });

  it('shows the Marco closest to done with its bar, Crônicas copy and a link to Crônicas', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    mockedMilestones.mockResolvedValue(milestones([milestone(CEM_SESSOES, 'Cem Sessões', 40, 100), milestone(MADRUGADOR, 'Madrugador', 4, 5)]));
    await renderDashboard();

    const card = await screen.findByTestId('dashboard-milestone');
    expect(within(card).getByText('Madrugador')).toBeTruthy();
    expect(within(card).getByText('4 de 5 sessões antes das 7h')).toBeTruthy();
    expect(within(card).getByText('80%')).toBeTruthy();
    expect(within(card).queryByText('Cem Sessões')).toBeNull();
    expect(within(screen.getByTestId('dashboard-side-column')).getByLabelText('Próximo Marco')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Ver marcos' }).props.href).toBe('/cronicas');
  });

  it('shows the Próximo Marco in the right column of the mobile grid', async () => {
    setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
    mockedMilestones.mockResolvedValue(milestones([milestone(MADRUGADOR, 'Madrugador', 4, 5)]));
    await renderDashboard();

    const card = await screen.findByTestId('dashboard-milestone');
    expect(within(card).getByText('4/5')).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-main-column')).getByLabelText('Próximo Marco')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Ver marcos' }).props.href).toBe('/cronicas');
  });

  it('says how many Marcos are earned when all of them are', async () => {
    mockedMilestones.mockResolvedValue(milestones([milestone(MADRUGADOR, 'Madrugador', 5, 5, true), milestone(CEM_SESSOES, 'Cem Sessões', 100, 100, true)]));
    await renderDashboard();

    expect(await screen.findByText('2 de 2 conquistados')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver marcos' }).props.href).toBe('/cronicas');
  });

  it('says so on mobile too, with the link, filling the whole row of the grid', async () => {
    setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
    mockedMilestones.mockResolvedValue(milestones([milestone(MADRUGADOR, 'Madrugador', 5, 5, true)]));
    await renderDashboard();

    const card = await screen.findByTestId('dashboard-milestone-done');
    expect(within(card).getByText('1 de 1 conquistados')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Ver marcos' }).props.href).toBe('/cronicas');
    expect(screen.getByTestId('dashboard-highlights').children).toHaveLength(2);
  });

  it('shows the loading state of each card while its query is pending', async () => {
    mockedObjectives.mockReturnValue(new Promise(() => {}));
    mockedMilestones.mockReturnValue(new Promise(() => {}));
    await renderDashboard();

    expect(await screen.findByText('Carregando os Objetivos…')).toBeTruthy();
    expect(screen.getByText('Carregando o Marco…')).toBeTruthy();
    expect(screen.getByTestId('dashboard-progression')).toBeTruthy();
  });

  it('says when there are no Marcos', async () => {
    await renderDashboard();

    expect(await screen.findByText('Nenhum Marco disponível.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ver marcos' })).toBeNull();
  });

  it('puts Objetivos de hoje after the Progressão in the main column', async () => {
    setMockWindowDimensions({ width: 1200, height: 800, fontScale: 1 });
    await renderDashboard();
    await screen.findByTestId('dashboard-objectives');

    const ids = screen.getByTestId('dashboard-main-column').children.filter((child) => typeof child !== 'string').map((child) => 'props' in child ? child.props.testID : undefined);
    expect(ids.indexOf('dashboard-objectives')).toBeGreaterThan(ids.indexOf('dashboard-progression'));
  });

  it('sets the met Objetivo apart on mobile: struck through, labelled Cumprido, green block', async () => {
    setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
    await renderDashboard();

    const block = await screen.findByTestId('dashboard-objective-one-session');
    expect(within(block).getByText('✓ Cumprido')).toBeTruthy();
    expect(StyleSheet.flatten(within(block).getByText('Conclua 1 sessão de foco').props.style).textDecorationLine).toBe('line-through');
    expect(StyleSheet.flatten(block.props.style).borderColor).toBe(theme.color.feedbackSuccess);
  });

  it('lets the next Objetivo block peek past the edge of the mobile carousel', async () => {
    setMockWindowDimensions({ width: 390, height: 800, fontScale: 1 });
    await renderDashboard();

    const blocks = within(await screen.findByTestId('dashboard-objectives-carousel')).getAllByTestId(/^dashboard-objective-(?!.*-bar)[a-z-]+$/);
    const widths = blocks.map((block) => StyleSheet.flatten(block.props.style).width);
    expect(new Set(blocks.map((block) => StyleSheet.flatten(block.props.style).height)).size).toBe(1);
    // Two whole blocks and a gap fit in the screen; the third starts before the right edge and runs past it.
    expect(widths[0] + 10 + widths[1] + 10).toBeLessThan(390);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeGreaterThan(390 - 2 * 24);
  });

  it('refreshes the Objetivos and the Marcos when pulling down on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderDashboard();
    await waitFor(() => expect(mockedMilestones).toHaveBeenCalledTimes(1));
    const objectivesCalls = mockedObjectives.mock.calls.length;

    await act(async () => { fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh'); });

    await waitFor(() => {
      expect(mockedMilestones).toHaveBeenCalledTimes(2);
      expect(mockedObjectives).toHaveBeenCalledTimes(objectivesCalls + 1);
    });
  });

  it('isolates a Marcos failure and retries only its own query', async () => {
    mockedMilestones.mockRejectedValueOnce(new Error('boom'));
    await renderDashboard();

    const error = await screen.findByTestId('dashboard-milestone-error');
    expect(screen.getByTestId('dashboard-objectives')).toBeTruthy();
    const objectivesCalls = mockedObjectives.mock.calls.length;
    const milestoneCalls = mockedMilestones.mock.calls.length;
    mockedMilestones.mockResolvedValue(milestones([milestone(MADRUGADOR, 'Madrugador', 4, 5)]));

    await act(async () => { fireEvent.press(within(error).getByRole('button', { name: 'Tentar novamente' })); });

    expect(await screen.findByTestId('dashboard-milestone')).toBeTruthy();
    expect(mockedMilestones).toHaveBeenCalledTimes(milestoneCalls + 1);
    expect(mockedObjectives).toHaveBeenCalledTimes(objectivesCalls);
  });

  it('refreshes the Objetivos and the Marcos with "Atualizar" and reports a partial failure', async () => {
    await renderDashboard();
    await screen.findByRole('button', { name: 'Atualizar dados' });
    await waitFor(() => expect(mockedMilestones).toHaveBeenCalledTimes(1));
    const objectivesCalls = mockedObjectives.mock.calls.length;
    mockedMilestones.mockRejectedValue(new Error('boom'));

    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Atualizar dados' })); });

    await waitFor(() => {
      expect(mockedMilestones).toHaveBeenCalledTimes(2);
      expect(mockedObjectives).toHaveBeenCalledTimes(objectivesCalls + 1);
    });
    expect(await screen.findByText('Alguns dados não foram atualizados.')).toBeTruthy();
  });
});
