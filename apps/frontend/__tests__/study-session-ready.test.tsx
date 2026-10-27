import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import { StudySessionScreen } from '@/features/study-session/study-session-screen';
import { getActiveStudySession, getRecentStudySessionSubjects, startStudySession } from '@/features/study-session/api';
import { estimatedXp, XP_PER_FOCUS_MINUTE } from '@/features/study-session/focus-choice';
import { formatFocusToday } from '@/features/study-session/xp';
import { getMyProfile, getSessionHistory, getSessionMetrics, type SessionHistoryItem, type SessionMetrics, type UserProfile } from '@/features/dashboard/api';
import { getActiveRaid, getMyGuild, type ActiveRaid, type MyGuild } from '@/features/guild/api';

jest.mock('@/features/study-session/forge-history', () => ({ ForgeHistory: () => null }));
jest.mock('@/features/guild/api', () => ({
  getMyGuild: jest.fn(),
  getActiveRaid: jest.fn(),
  joinRaid: jest.fn(),
}));
jest.mock('@/features/dashboard/api', () => ({
  getMyProfile: jest.fn(),
  getSessionMetrics: jest.fn(),
  getSessionHistory: jest.fn(),
  getRecentStudySessions: jest.fn(),
}));
jest.mock('@/features/chronicles/api', () => ({ getObjectives: jest.fn(async () => ({ daily: { items: [] } })) }));
jest.mock('@/core/preferences/preferences-storage', () => ({
  preferencesStorage: { read: jest.fn(async () => null), write: jest.fn(async () => undefined) },
}));
jest.mock('@/features/study-session/sounds', () => ({
  playSessionSound: jest.fn(), releaseSessionSounds: jest.fn(), stopSessionSounds: jest.fn(), unlockSessionSounds: jest.fn(),
}));
jest.mock('@/features/study-session/api', () => ({
  STUDY_SESSION_PRESETS: [900, 1500, 3000],
  getActiveStudySession: jest.fn(),
  getRecentStudySessionSubjects: jest.fn(),
  startStudySession: jest.fn(),
}));

const getActive = getActiveStudySession as jest.MockedFunction<typeof getActiveStudySession>;
const getRecent = getRecentStudySessionSubjects as jest.MockedFunction<typeof getRecentStudySessionSubjects>;
const start = startStudySession as jest.MockedFunction<typeof startStudySession>;
const profile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const metrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;
const history = getSessionHistory as jest.MockedFunction<typeof getSessionHistory>;
const myGuild = getMyGuild as jest.MockedFunction<typeof getMyGuild>;
const activeRaid = getActiveRaid as jest.MockedFunction<typeof getActiveRaid>;

const hero = { displayName: 'Knightshade', equipped: [] } as unknown as UserProfile;
const dayMetrics = { currentStreakDays: 27, validSecondsToday: 4200 } as SessionMetrics;
const WINDOW = { desktop: 1440, phone: 390 };

function setWidth(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 2, fontScale: 1 }, screen: { width, height: 900, scale: 2, fontScale: 1 } });
}

async function renderReady() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  const view = await render(<QueryClientProvider client={client}><StudySessionScreen /></QueryClientProvider>);
  await view.findByTestId('study-session-setup');
  return view;
}

beforeEach(() => {
  setWidth(WINDOW.desktop);
  getActive.mockResolvedValue(null);
  getRecent.mockResolvedValue([]);
  profile.mockResolvedValue(hero);
  metrics.mockResolvedValue(dayMetrics);
  history.mockResolvedValue({ items: [], nextCursor: null });
  myGuild.mockResolvedValue(null);
  activeRaid.mockResolvedValue(null);
});

afterEach(() => {
  setWidth(750);
  jest.clearAllMocks();
});

describe('estimated XP', () => {
  it('is the planned minutes times the shared rate, and none for Livre', () => {
    expect(XP_PER_FOCUS_MINUTE).toBe(10);
    expect(estimatedXp(1500)).toBe(250);
    expect(estimatedXp('free')).toBeNull();
  });

  it('formats the valid focus of the day', () => {
    expect([0, 1500, 3600, 4200].map(formatFocusToday)).toEqual(['0 min', '25 min', '1h', '1h 10min']);
  });
});

describe('Forja Pronta', () => {
  it('shows the Bigorna ring at the default duration with the estimated XP, Constância and focus of the day', async () => {
    const view = await renderReady();

    expect(view.getByText('25:00')).toBeTruthy();
    expect(view.getByText('/ 25:00')).toBeTruthy();
    expect(await view.findByText('+250 XP')).toBeTruthy();
    expect(view.getByText('estimado')).toBeTruthy();
    expect(await view.findByText('27 dias')).toBeTruthy();
    expect(view.getByText('1h 10min')).toBeTruthy();
    expect(view.getByLabelText('Constância: 27 dias')).toBeTruthy();
    expect(view.getByLabelText('Foco válido hoje: 1h 10min')).toBeTruthy();
    view.unmount();
  });

  it('names the Herói under the anvil', async () => {
    const view = await renderReady();

    expect(await view.findByTestId('study-session-hero-caption')).toHaveTextContent('Knightshade aguarda na bigorna');
    view.unmount();
  });

  it('follows the chosen duration with the estimate, and the ring with the time', async () => {
    const view = await renderReady();
    await view.findByText('+250 XP');

    await fireEvent.press(view.getByTestId('study-duration-50'));
    expect(view.getByText('+500 XP')).toBeTruthy();
    expect(view.getByText('50:00')).toBeTruthy();
    await fireEvent.press(view.getByTestId('study-duration-15'));
    expect(view.getByText('+150 XP')).toBeTruthy();
    view.unmount();
  });

  it('shows the rate per minute, a zeroed ring and the caption for Livre', async () => {
    const view = await renderReady();
    await view.findByText('+250 XP');

    await fireEvent.press(view.getByTestId('study-duration-free'));
    expect(view.getByText('00:00')).toBeTruthy();
    expect(view.getByText('conta até você parar')).toBeTruthy();
    expect(view.getByText('10 XP')).toBeTruthy();
    expect(view.getByText('por minuto de foco')).toBeTruthy();
    expect(view.queryByText(/^\+\d+ XP$/)).toBeNull();
    view.unmount();
  });

  it('offers the durations as one radiogroup that replaces the gear panel', async () => {
    const view = await renderReady();

    expect(view.getByLabelText('Duração')).toBeTruthy();
    expect(view.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel))
      .toEqual(['15 minutos', '25 minutos', '50 minutos', 'Foco livre, sem duração definida']);
    expect(view.queryByRole('button', { name: 'Configurar duração' })).toBeNull();
    expect(view.getByTestId('study-duration-25').props.accessibilityState.checked).toBe(true);
    view.unmount();
  });

  it('shows the rules card with the Figma copy', async () => {
    const view = await renderReady();

    expect(view.getByText('Regras da forja')).toBeTruthy();
    expect(view.getByText('Terminar uma sessão por dia mantém sua constância.')).toBeTruthy();
    view.unmount();
  });

  it('lists the sessions that ended today in the Hoje card', async () => {
    history.mockResolvedValue({
      items: [
        { id: 's1', subject: 'Cálculo II', state: 'completed', durationValidSeconds: 1500, xpAwarded: 250 },
        { id: 's2', subject: null, state: 'stopped_early', durationValidSeconds: 760, xpAwarded: 120 },
      ] as SessionHistoryItem[],
      nextCursor: null,
    });
    const view = await renderReady();

    expect(await view.findByText('Cálculo II · 25:00 · +250 XP')).toBeTruthy();
    expect(view.getByText('Sem matéria · 12:40 · +120 XP')).toBeTruthy();
    view.unmount();
  });
});

describe('Forja Pronta when the supporting data fails', () => {
  it('leaves out the Constância and focus cells but keeps the estimate and the start', async () => {
    metrics.mockRejectedValue(new Error('metrics down'));
    start.mockResolvedValue({ id: 'study-1' } as never);
    const view = await renderReady();

    expect(await view.findByText('+250 XP')).toBeTruthy();
    await waitFor(() => expect(metrics).toHaveBeenCalled());
    expect(view.queryByText('constância')).toBeNull();
    expect(view.queryByText('foco hoje')).toBeNull();
    await fireEvent.press(view.getByTestId('study-session-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(1500, expect.any(String), null));
    view.unmount();
  });

  it('leaves out the Herói and the Hoje card when the profile and the history fail', async () => {
    profile.mockRejectedValue(new Error('profile down'));
    history.mockRejectedValue(new Error('history down'));
    const view = await renderReady();

    await waitFor(() => expect(profile).toHaveBeenCalled());
    await waitFor(() => expect(history).toHaveBeenCalled());
    expect(view.queryByTestId('study-session-hero')).toBeNull();
    expect(view.queryByTestId('study-session-today-card')).toBeNull();
    expect(view.getByTestId('study-session-start')).toBeTruthy();
    expect(view.getByText('Regras da forja')).toBeTruthy();
    view.unmount();
  });
});

describe('Modo', () => {
  const raid = { id: 'raid-1', status: 'active', mission: { name: 'Torre de Marfim' }, me: { participating: true } } as unknown as ActiveRaid;

  it('is not offered without an active Raid', async () => {
    const view = await renderReady();

    expect(view.queryByLabelText('Tipo de sessão')).toBeNull();
    expect(view.queryByText('Modo')).toBeNull();
    view.unmount();
  });

  it('is offered with an active Raid, with the Raid line for guild mode', async () => {
    myGuild.mockResolvedValue({ guild: { id: 'guild-1' } } as MyGuild);
    activeRaid.mockResolvedValue(raid);
    const view = await renderReady();

    expect(await view.findByLabelText('Tipo de sessão')).toBeTruthy();
    expect(view.getByText('Modo')).toBeTruthy();
    await fireEvent.press(view.getByTestId('study-session-mode-guild'));
    expect(view.getByTestId('study-session-mode-guild').props.accessibilityState.checked).toBe(true);
    expect(view.getByText('O XP desta sessão conta para a Raid Torre de Marfim.')).toBeTruthy();
    view.unmount();
  });
});

describe('Modo Guilda on the Pronta', () => {
  const raid = { id: 'raid-1', status: 'active', mission: { name: 'Torre de Marfim' }, me: { participating: true } } as unknown as ActiveRaid;

  async function renderWithRaid() {
    myGuild.mockResolvedValue({ guild: { id: 'guild-1' } } as MyGuild);
    activeRaid.mockResolvedValue(raid);
    const view = await renderReady();
    await view.findByLabelText('Tipo de sessão');
    return view;
  }

  it('starts a session for the Raid from the guild option', async () => {
    start.mockResolvedValue({ id: 'study-1' } as never);
    const view = await renderWithRaid();

    await fireEvent.press(view.getByTestId('study-session-mode-guild'));
    await fireEvent.press(view.getByTestId('study-session-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(1500, expect.any(String), null, 'raid-1'));
    view.unmount();
  });

  it('warns and falls back to solo when the Raid ended before the start', async () => {
    start.mockRejectedValue(new ApiError('conflict', { status: 409, problemType: 'https://wise.app/errors/raid-ended' }));
    const view = await renderWithRaid();

    await fireEvent.press(view.getByTestId('study-session-mode-guild'));
    await fireEvent.press(view.getByTestId('study-session-start'));
    expect(await view.findByTestId('study-session-raid-ended')).toBeTruthy();
    expect(view.getByTestId('study-session-mode-solo').props.accessibilityState.checked).toBe(true);
    view.unmount();
  });
});

describe('Forja Pronta on a phone', () => {
  it('drops the card and the summary, and keeps starting possible from the footer', async () => {
    setWidth(WINDOW.phone);
    start.mockResolvedValue({ id: 'study-1' } as never);
    const view = await renderReady();

    expect(view.queryByTestId('study-session-prep')).toBeNull();
    expect(view.queryByTestId('study-session-summary')).toBeNull();
    expect(view.getByLabelText('Matéria (opcional)')).toBeTruthy();
    await fireEvent.press(view.getByTestId('study-session-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(1500, expect.any(String), null));
    view.unmount();
  });

  it('scrolls the recent Matérias sideways', async () => {
    setWidth(WINDOW.phone);
    getRecent.mockResolvedValue(['Física', 'Cálculo II']);
    const view = await renderReady();

    expect(await view.findByRole('button', { name: 'Física' })).toBeTruthy();
    expect(view.getByTestId('study-session-subject-scroll').props.horizontal).toBe(true);
    view.unmount();
  });
});
