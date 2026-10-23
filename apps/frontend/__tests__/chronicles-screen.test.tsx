import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSessionHistory, getWeekSummary, type SessionHistoryItem, type WeekSummary } from '@/features/dashboard/api';
import { ChroniclesScreen } from '@/features/chronicles/chronicles-screen';
import { getMilestones, getObjectives, type Milestones, type Objectives } from '@/features/chronicles/api';
import { renewalLabel } from '@/features/chronicles/objectives';
import { formatFocusTime, weekBars } from '@/features/chronicles/week';
import { resetMockWindowDimensions, setMockWindowDimensions } from '../test-utils/window-dimensions';
import { dayHeading, diaryStatus, diaryXp, groupByDay, weekRangeLabel } from '@/features/chronicles/diary';

jest.mock('react-native', () => require('../test-utils/window-dimensions').createReactNativeMock());

jest.mock('@/features/dashboard/api', () => ({
  getSessionHistory: jest.fn(),
  getWeekSummary: jest.fn(),
  getSessionMetrics: jest.fn(),
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
}));

jest.mock('@/features/chronicles/api', () => ({ getObjectives: jest.fn(), getMilestones: jest.fn() }));

const mockedObjectives = getObjectives as jest.MockedFunction<typeof getObjectives>;
const mockedMilestones = getMilestones as jest.MockedFunction<typeof getMilestones>;
const mockedHistory = getSessionHistory as jest.MockedFunction<typeof getSessionHistory>;
const mockedWeek = getWeekSummary as jest.MockedFunction<typeof getWeekSummary>;

const day = (date: string, validSeconds: number, sessionCount = validSeconds > 0 ? 1 : 0) => ({ date, validSeconds, sessionCount });
const WEEK: WeekSummary = {
  weekStart: '2026-10-19', weekEnd: '2026-10-25', today: '2026-10-22',
  validSeconds: 34800, sessionCount: 14, xp: 3400,
  days: [day('2026-10-19', 3000), day('2026-10-20', 6000), day('2026-10-21', 0), day('2026-10-22', 12000), day('2026-10-23', 0), day('2026-10-24', 0), day('2026-10-25', 0)],
  subjects: [{ subject: 'Cálculo II', validSeconds: 13200 }, { subject: 'Sem matéria', validSeconds: 6600 }],
};

const objectives = (progress: [number, number, number]): Objectives => ({
  daily: {
    date: '2026-10-22',
    renewsAt: '2026-10-23T03:00:00.000Z',
    items: [
      { id: 'one-session', title: 'Conclua 1 sessão de foco', progress: progress[0], target: 1, coins: 5, completed: progress[0] >= 1 },
      { id: 'four-sessions', title: 'Conclua 4 sessões hoje', progress: progress[1], target: 4, coins: 15, completed: progress[1] >= 4 },
      { id: 'fifty-minutes', title: 'Faça uma sessão de 50 minutos', progress: progress[2], target: 1, coins: 10, completed: progress[2] >= 1 },
    ],
  },
});

const MADRUGADOR = 'c05e71c0-0000-4000-8000-000000000003';
const CEM_SESSOES = 'c05e71c0-0000-4000-8000-000000000006';
const GRIMORIO = 'c05e71c0-0000-4000-8000-000000000009';
const FORJA = 'c05e71c0-0000-4000-8000-00000000000b';

/** Madrugador conquistado, Cem Sessões em 87 de 100 e as duas Raids por vencer (o frame v3). */
const MILESTONES: Milestones = {
  earned: 1,
  total: 4,
  items: [
    { id: MADRUGADOR, name: 'Madrugador', progress: 5, target: 5, earned: true },
    { id: CEM_SESSOES, name: 'Cem Sessões', progress: 87, target: 100, earned: false },
    { id: GRIMORIO, name: 'Marcador do Grimório', progress: 0, target: 1, earned: false },
    { id: FORJA, name: 'Brasão da Forja', progress: 0, target: 1, earned: false },
  ],
};

const item = (id: string, endedAt: string, overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem => ({
  id, subject: 'Cálculo II', mode: 'solo', state: 'completed',
  startedAt: endedAt, endedAt, durationValidSeconds: 2400, xpAwarded: 400, discardedReason: null, cappedReason: null, cyclePosition: 1,
  ...overrides,
});

async function renderChronicles() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ChroniclesScreen /></QueryClientProvider>);
}

beforeEach(() => {
  mockedWeek.mockResolvedValue(WEEK);
  mockedMilestones.mockResolvedValue(MILESTONES);
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T18:00:00.000Z'));
});
afterEach(() => { jest.restoreAllMocks(); mockedHistory.mockReset(); mockedWeek.mockReset(); mockedObjectives.mockReset(); mockedMilestones.mockReset(); resetMockWindowDimensions(); });

describe('Diário helpers', () => {
  it('names the São Paulo week from Monday to Sunday', () => {
    expect(weekRangeLabel('2026-10-22')).toBe('19/10 a 25/10');
    expect(weekRangeLabel('2026-10-19')).toBe('19/10 a 25/10');
    expect(weekRangeLabel('2026-10-25')).toBe('19/10 a 25/10');
    expect(weekRangeLabel('2026-10-26')).toBe('26/10 a 01/11');
  });

  it('headlines the days as Hoje, Ontem and then the weekday', () => {
    expect(dayHeading('2026-10-22', '2026-10-22')).toBe('HOJE · QUINTA, 22/10');
    expect(dayHeading('2026-10-21', '2026-10-22')).toBe('ONTEM · QUARTA, 21/10');
    expect(dayHeading('2026-10-20', '2026-10-22')).toBe('TERÇA, 20/10');
  });

  it('groups on the São Paulo day, so 23h is still the same day', () => {
    const days = groupByDay([
      item('a', '2026-10-23T02:30:00.000Z'), // 23:30 on the 22nd in São Paulo
      item('b', '2026-10-22T15:00:00.000Z'),
      item('c', '2026-10-21T15:00:00.000Z'),
    ], '2026-10-22');
    expect(days.map((day) => [day.dayKey, day.items.map(({ id }) => id)])).toEqual([['2026-10-22', ['a', 'b']], ['2026-10-21', ['c']]]);
  });

  it('describes truncated, discarded and ordinary sessions', () => {
    expect(diaryStatus(item('a', '2026-10-22T15:00:00.000Z'))).toBe('Concluída');
    expect(diaryStatus(item('b', '2026-10-22T15:00:00.000Z', { state: 'stopped_early' }))).toBe('Concluída');
    expect(diaryStatus(item('c', '2026-10-22T15:00:00.000Z', { cappedReason: 'daily-limit' }))).toBe('Truncada · XP limitado pelo teto diário');
    expect(diaryStatus(item('d', '2026-10-22T15:00:00.000Z', { cappedReason: 'continuous-limit' }))).toBe('Truncada · XP limitado ao máximo de sessão contínua');
    const discarded = item('e', '2026-10-22T15:00:00.000Z', { state: 'discarded', xpAwarded: 0 });
    expect(diaryStatus(discarded)).toBe('Não contabilizada');
    expect(diaryXp(discarded)).toBe('—');
    expect(diaryXp(item('f', '2026-10-22T15:00:00.000Z'))).toBe('+400 XP');
  });
});

describe('Objetivos helpers', () => {
  it('counts down to the renewal in hours and minutes, never below zero', () => {
    const at = Date.parse('2026-10-22T18:00:00.000Z');
    expect(renewalLabel('2026-10-23T03:00:00.000Z', at)).toBe('Renova em 09h 00min');
    expect(renewalLabel('2026-10-22T18:07:00.000Z', at)).toBe('Renova em 00h 07min');
    expect(renewalLabel('2026-10-22T17:00:00.000Z', at)).toBe('Renova em 00h 00min');
  });
});

describe('Crônicas', () => {
  it('opens on the Diário with the São Paulo week in the header', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    await renderChronicles();

    expect(screen.getByRole('header', { name: 'Crônicas' })).toBeTruthy();
    expect(screen.getByTestId('chronicles-week')).toHaveTextContent('◈ Semana de 19/10 a 25/10');
    expect(screen.getByTestId('chronicles-tab-diario').props.accessibilityState.selected).toBe(true);
    expect(await screen.findByTestId('diary-empty')).toBeTruthy();
  });

  it('shows today\'s Objetivos with progress and the time until they renew', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    mockedObjectives.mockResolvedValue(objectives([1, 2, 0]));
    await renderChronicles();

    await fireEvent.press(screen.getByTestId('chronicles-tab-objetivos'));

    expect(await screen.findByTestId('objectives-daily')).toBeTruthy();
    expect(screen.getByTestId('objectives-renewal')).toHaveTextContent('Renova em 09h 00min');
    expect(within(screen.getByTestId('objective-four-sessions')).getByText('Conclua 4 sessões hoje')).toBeTruthy();
    expect(screen.getByTestId('objective-four-sessions-count')).toHaveTextContent('2/4');
    expect(screen.getByTestId('objective-fifty-minutes-count')).toHaveTextContent('0/1');
    expect(screen.queryByTestId('diary')).toBeNull();
    await fireEvent.press(screen.getByTestId('chronicles-tab-diario'));
    expect(await screen.findByTestId('diary')).toBeTruthy();
  });

  it('shows "+N Moedas" on a completed Objetivo, with no button to claim it', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    mockedObjectives.mockResolvedValue(objectives([1, 2, 0]));
    await renderChronicles();
    await fireEvent.press(screen.getByTestId('chronicles-tab-objetivos'));

    const done = await screen.findByTestId('objective-one-session');
    expect(within(done).getByText('+5 Moedas')).toBeTruthy();
    expect(done.props.accessibilityLabel).toContain('Cumprido');
    expect(within(done).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('objective-four-sessions')).getByText('+15 Moedas')).toBeTruthy();
    expect(within(screen.getByTestId('objective-four-sessions')).queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Resgatar/)).toBeNull();
  });

  it('offers a retry when the Objetivos fail to load', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    mockedObjectives.mockRejectedValueOnce(new Error('boom'));
    mockedObjectives.mockResolvedValueOnce(objectives([0, 0, 0]));
    await renderChronicles();
    await fireEvent.press(screen.getByTestId('chronicles-tab-objetivos'));

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByTestId('objective-one-session')).toBeTruthy();
  });

  describe('Marcos', () => {
    const openObjectives = async () => {
      mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
      mockedObjectives.mockResolvedValue(objectives([0, 0, 0]));
      await renderChronicles();
      await fireEvent.press(screen.getByTestId('chronicles-tab-objetivos'));
    };

    it('shows "N de 4", the earned Badge as Conquistado and the progress of the others', async () => {
      await openObjectives();

      expect(await screen.findByTestId('milestones')).toBeTruthy();
      expect(screen.getByTestId('milestones-count')).toHaveTextContent('1 de 4');
      expect(screen.queryByText('Selo dos Madrugadores')).toBeNull();
      expect(screen.getAllByTestId(/^milestone-[^-]+-[^-]+-[^-]+-[^-]+-[^-]+$/)).toHaveLength(4);
    });

    it('shows each Marco as a mobile block with its short name and badge', async () => {
      await openObjectives();

      await screen.findByTestId('milestones');
      expect(within(screen.getByTestId('milestone-' + MADRUGADOR)).getByText('Madrugador')).toBeTruthy();
      expect(screen.getByTestId('milestone-' + MADRUGADOR + '-badge')).toHaveTextContent('✓');
      expect(screen.getByTestId('milestone-' + CEM_SESSOES + '-badge')).toHaveTextContent('87%');
      expect(within(screen.getByTestId('milestone-' + GRIMORIO)).getByText('Grimório')).toBeTruthy();
      expect(screen.getByTestId('milestone-' + GRIMORIO + '-badge')).toHaveTextContent('0/1');
      expect(within(screen.getByTestId('milestone-' + FORJA)).getByText('Forja')).toBeTruthy();
    });

    describe('on desktop', () => {
      beforeEach(() => {
        jest.replaceProperty(Platform, 'OS', 'web');
        setMockWindowDimensions({ width: 1440, height: 1024 });
      });

      it('lists the Marcos as rows: Conquistado, sessions in progress and the Raid to win', async () => {
        await openObjectives();

        await screen.findByTestId('milestones');
        expect(within(screen.getByTestId('milestone-' + MADRUGADOR)).getByText('Conquistado')).toBeTruthy();
        expect(screen.queryByTestId('milestone-' + MADRUGADOR + '-bar')).toBeNull();
        expect(screen.getByTestId('milestone-' + CEM_SESSOES + '-bar')).toBeTruthy();
        expect(screen.getByTestId('milestone-' + MADRUGADOR + '-description')).toHaveTextContent('5 sessões antes das 7h');
        expect(screen.getByTestId('milestone-' + CEM_SESSOES + '-description')).toHaveTextContent('87 de 100 sessões');
        expect(screen.getByTestId('milestone-' + GRIMORIO + '-description')).toHaveTextContent('Vença a Raid Cerco ao Grimório · 0 de 1');
        expect(screen.getByTestId('milestone-' + FORJA + '-description')).toHaveTextContent('Vença a Raid Forja dos Sábios · 0 de 1');
      });

      it('shows the Brasão da Forja as Conquistado, with 1 de 1, once its Raid is won', async () => {
        mockedMilestones.mockResolvedValue({
          earned: 2,
          total: 4,
          items: [MILESTONES.items[0]!, MILESTONES.items[1]!, MILESTONES.items[2]!, { ...MILESTONES.items[3]!, progress: 1, earned: true }],
        });
        await openObjectives();

        await screen.findByTestId('milestones');
        expect(within(screen.getByTestId('milestone-' + FORJA)).getByText('Conquistado')).toBeTruthy();
        expect(screen.getByTestId('milestone-' + FORJA + '-description')).toHaveTextContent('Vença a Raid Forja dos Sábios · 1 de 1');
      });

      it('shows a Raid Marco as 1 de 1 once it is won', async () => {
        mockedMilestones.mockResolvedValue({
          earned: 2,
          total: 4,
          items: [MILESTONES.items[0]!, MILESTONES.items[1]!, { ...MILESTONES.items[2]!, progress: 1, earned: true }, MILESTONES.items[3]!],
        });
        await openObjectives();

        await screen.findByTestId('milestones');
        expect(screen.getByTestId('milestones-count')).toHaveTextContent('2 de 4');
        expect(within(screen.getByTestId('milestone-' + GRIMORIO)).getByText('Conquistado')).toBeTruthy();
      });
    });

    it('offers a retry when the Marcos fail to load', async () => {
      mockedMilestones.mockRejectedValueOnce(new Error('boom'));
      await openObjectives();

      await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));

      expect(await screen.findByTestId('milestones')).toBeTruthy();
    });
  });

  it('lists the sessions grouped by São Paulo day with time, subject, status and XP', async () => {
    mockedHistory.mockResolvedValue({
      items: [
        item('a', '2026-10-22T17:20:00.000Z'),
        item('b', '2026-10-21T19:40:00.000Z', { subject: 'Direito', mode: 'guild', cappedReason: 'daily-limit', xpAwarded: 150, durationValidSeconds: 900 }),
        item('c', '2026-10-20T10:10:00.000Z', { subject: null, state: 'discarded', xpAwarded: 0 }),
      ],
      nextCursor: null,
    });
    await renderChronicles();

    const today = await screen.findByTestId('diary-day-2026-10-22');
    expect(within(today).getByText('HOJE · QUINTA, 22/10')).toBeTruthy();
    expect(within(today).getByText('14:20')).toBeTruthy();
    expect(within(today).getByText('Cálculo II')).toBeTruthy();
    expect(screen.getByTestId('diary-xp-a')).toHaveTextContent('+400 XP');
    expect(within(screen.getByTestId('diary-day-2026-10-21')).getByText('ONTEM · QUARTA, 21/10')).toBeTruthy();
    expect(screen.getByTestId('diary-status-b')).toHaveTextContent('Truncada · XP limitado pelo teto diário');
    expect(screen.getByTestId('diary-xp-b')).toHaveTextContent('+150 XP');
    expect(screen.getByTestId('diary-status-c')).toHaveTextContent('Não contabilizada');
    expect(within(screen.getByTestId('diary-item-c')).getByText('Sem matéria')).toBeTruthy();
    expect(screen.getByTestId('diary-xp-c')).toHaveTextContent('—');
    expect(mockedHistory).toHaveBeenCalledWith(expect.objectContaining({ date: undefined, state: undefined, cursor: null }));
  });

  it('pages by cursor through several days', async () => {
    mockedHistory.mockResolvedValueOnce({ items: [item('a', '2026-10-22T17:20:00.000Z')], nextCursor: 'next' });
    mockedHistory.mockResolvedValueOnce({ items: [item('b', '2026-10-15T17:20:00.000Z')], nextCursor: null });
    await renderChronicles();

    await fireEvent.press(await screen.findByTestId('diary-more'));

    expect(await screen.findByTestId('diary-item-b')).toBeTruthy();
    expect(screen.getByTestId('diary-item-a')).toBeTruthy();
    expect(screen.getByTestId('diary-day-2026-10-15')).toBeTruthy();
    expect(mockedHistory).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }));
    expect(screen.queryByTestId('diary-more')).toBeNull();
  });

  it.each([
    ['diary-filter-completed', 'completed'],
    ['diary-filter-truncated', 'truncated'],
    ['diary-filter-discarded', 'discarded'],
  ])('asks the server for the "%s" filter', async (testID, state) => {
    mockedHistory.mockResolvedValue({ items: [item('a', '2026-10-22T17:20:00.000Z')], nextCursor: null });
    await renderChronicles();
    await screen.findByTestId('diary-item-a');

    await fireEvent.press(screen.getByTestId(testID));

    expect(screen.getByTestId(testID).props.accessibilityState.selected).toBe(true);
    await screen.findByTestId('diary-item-a');
    expect(mockedHistory).toHaveBeenLastCalledWith(expect.objectContaining({ state, cursor: null }));
  });

  it('returns to every outcome with Todas', async () => {
    mockedHistory.mockResolvedValue({ items: [item('a', '2026-10-22T17:20:00.000Z')], nextCursor: null });
    await renderChronicles();
    await screen.findByTestId('diary-item-a');
    await fireEvent.press(screen.getByTestId('diary-filter-truncated'));
    await screen.findByTestId('diary-item-a');

    await fireEvent.press(screen.getByTestId('diary-filter-all'));

    await screen.findByTestId('diary-item-a');
    expect(mockedHistory).toHaveBeenLastCalledWith(expect.objectContaining({ state: undefined }));
  });

  it('offers a retry when the Diário fails to load', async () => {
    mockedHistory.mockRejectedValueOnce(new Error('boom'));
    mockedHistory.mockResolvedValueOnce({ items: [item('a', '2026-10-22T17:20:00.000Z')], nextCursor: null });
    await renderChronicles();

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByTestId('diary-item-a')).toBeTruthy();
  });
});

describe('Cards da semana', () => {
  it('shows the week range, the totals and the subjects of the week', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    await renderChronicles();

    expect(await screen.findByTestId('week-range')).toHaveTextContent('19/10 a 25/10');
    expect(screen.getByTestId('week-focus')).toHaveTextContent('9h 40');
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('14');
    expect(screen.getByTestId('week-xp')).toHaveTextContent('3.400');
    expect(within(screen.getByTestId('week-subjects')).getByText('Matérias da semana')).toBeTruthy();
    expect(within(screen.getByTestId('week-subject-Cálculo II')).getByText('3h 40')).toBeTruthy();
    expect(within(screen.getByTestId('week-subject-Sem matéria')).getByText('1h 50')).toBeTruthy();
  });

  it('draws one bar per day, Monday to Sunday, with today highlighted', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    await renderChronicles();

    const chart = await screen.findByTestId('week-chart');
    expect(within(chart).getAllByTestId(/^week-bar-2026-/)).toHaveLength(7);
    expect(screen.getAllByTestId('week-bar-today')).toHaveLength(1);
    expect(within(screen.getByTestId('week-bar-2026-10-22')).getByTestId('week-bar-today')).toBeTruthy();
  });

  it('says so when no session counted this week', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    mockedWeek.mockResolvedValue({ ...WEEK, validSeconds: 0, sessionCount: 0, xp: 0, subjects: [], days: WEEK.days.map((d) => day(d.date, 0)) });
    await renderChronicles();

    expect(await screen.findByTestId('week-subjects-empty')).toBeTruthy();
    expect(screen.getByTestId('week-focus')).toHaveTextContent('0 min');
  });

  it('keeps the Diário usable when the week fails to load', async () => {
    mockedHistory.mockResolvedValue({ items: [item('a', '2026-10-22T17:20:00.000Z')], nextCursor: null });
    mockedWeek.mockRejectedValue(new Error('boom'));
    await renderChronicles();

    expect(await screen.findByTestId('week-error')).toBeTruthy();
    expect(await screen.findByTestId('diary-item-a')).toBeTruthy();
  });
});

describe('Week helpers', () => {
  it('formats focus time in hours and minutes', () => {
    expect(formatFocusTime(13200)).toBe('3h 40');
    expect(formatFocusTime(7500)).toBe('2h 05');
    expect(formatFocusTime(2400)).toBe('40 min');
    expect(formatFocusTime(0)).toBe('0 min');
  });

  it('scales the bars to the busiest day and flags today', () => {
    const bars = weekBars(WEEK);
    expect(bars.map((bar) => bar.initial).join('')).toBe('STQQSSD');
    expect(bars[3]).toMatchObject({ height: 96, today: true });
    expect(bars[0]?.height).toBe(24);
    expect(bars[2]?.height).toBe(4);
    expect(bars.filter((bar) => bar.today)).toHaveLength(1);
  });
});
