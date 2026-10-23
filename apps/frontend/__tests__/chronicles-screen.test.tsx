import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSessionHistory, getWeekSummary, type SessionHistoryItem, type WeekSummary } from '@/features/dashboard/api';
import { ChroniclesScreen } from '@/features/chronicles/chronicles-screen';
import { formatFocusTime, weekBars } from '@/features/chronicles/week';
import { dayHeading, diaryStatus, diaryXp, groupByDay, weekRangeLabel } from '@/features/chronicles/diary';

jest.mock('@/features/dashboard/api', () => ({
  getSessionHistory: jest.fn(),
  getWeekSummary: jest.fn(),
  getSessionMetrics: jest.fn(),
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
}));

const mockedHistory = getSessionHistory as jest.MockedFunction<typeof getSessionHistory>;
const mockedWeek = getWeekSummary as jest.MockedFunction<typeof getWeekSummary>;

const day = (date: string, validSeconds: number, sessionCount = validSeconds > 0 ? 1 : 0) => ({ date, validSeconds, sessionCount });
const WEEK: WeekSummary = {
  weekStart: '2026-10-19', weekEnd: '2026-10-25', today: '2026-10-22',
  validSeconds: 34800, sessionCount: 14, xp: 3400,
  days: [day('2026-10-19', 3000), day('2026-10-20', 6000), day('2026-10-21', 0), day('2026-10-22', 12000), day('2026-10-23', 0), day('2026-10-24', 0), day('2026-10-25', 0)],
  subjects: [{ subject: 'Cálculo II', validSeconds: 13200 }, { subject: 'Sem matéria', validSeconds: 6600 }],
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
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T18:00:00.000Z'));
});
afterEach(() => { jest.restoreAllMocks(); mockedHistory.mockReset(); mockedWeek.mockReset(); });

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

describe('Crônicas', () => {
  it('opens on the Diário with the São Paulo week in the header', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    await renderChronicles();

    expect(screen.getByRole('header', { name: 'Crônicas' })).toBeTruthy();
    expect(screen.getByTestId('chronicles-week')).toHaveTextContent('◈ Semana de 19/10 a 25/10');
    expect(screen.getByTestId('chronicles-tab-diario').props.accessibilityState.selected).toBe(true);
    expect(await screen.findByTestId('diary-empty')).toBeTruthy();
  });

  it('shows an empty state on Objetivos', async () => {
    mockedHistory.mockResolvedValue({ items: [], nextCursor: null });
    await renderChronicles();

    await fireEvent.press(screen.getByTestId('chronicles-tab-objetivos'));
    expect(screen.getByTestId('chronicles-objectives-empty')).toBeTruthy();
    expect(screen.queryByTestId('diary')).toBeNull();
    await fireEvent.press(screen.getByTestId('chronicles-tab-diario'));
    expect(await screen.findByTestId('diary')).toBeTruthy();
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
