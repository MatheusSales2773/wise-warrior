import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { theme } from '@/design-system';
import { getMyProfile, getRecentStudySessions, getSessionMetrics, getWeekSummary, type UserProfile, type RecentStudySession, type SessionMetrics, type WeekSummary } from '@/features/dashboard/api';
import { getObjectives, type Objectives } from '@/features/chronicles/api';
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

jest.mock('@/features/chronicles/api', () => ({ getObjectives: jest.fn() }));
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
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;

async function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  mockedMetrics.mockResolvedValue(metrics);
  mockedObjectives.mockResolvedValue(objectives());
  mockedWeek.mockResolvedValue(weekSummary());
  mockedCoins.mockResolvedValue(1240);
  mockedCycle.mockResolvedValue(cycle());
  mockedActive.mockResolvedValue(null);
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

  it('shows the guild preview and its navigation beside recent activity', async () => {
    mockedProfile.mockResolvedValue(profile);
    mockedActivity.mockResolvedValue([]);
    await renderDashboard();

    await screen.findByTestId('dashboard-activity-empty');
    expect(screen.getByTestId('dashboard-guild-preview')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entrar na Guilda' })).toBeTruthy();
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
    expect(screen.getByLabelText('Progressão')).toBeTruthy();
    expect(screen.getByLabelText('Atividade recente')).toBeTruthy();
    expect(screen.getByTestId('dashboard-grid').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'column' })]));
    expect(screen.getByTestId('dashboard-main-column').children.filter((child) => typeof child !== 'string').map((child) => 'props' in child ? child.props.testID : undefined)).toEqual([
      'dashboard-profile',
      'dashboard-progression',
      'dashboard-metrics',
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
