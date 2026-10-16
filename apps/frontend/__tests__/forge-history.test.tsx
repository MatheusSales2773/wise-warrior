import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/core/api/api-error';
import { getSessionHistory, getSessionMetrics, type SessionHistoryItem, type SessionMetrics } from '@/features/dashboard/api';
import { ForgeHistory, historyOutcome, weeklySummary } from '@/features/study-session/forge-history';

jest.mock('@/features/dashboard/api', () => ({
  getSessionHistory: jest.fn(),
  getSessionMetrics: jest.fn(),
  getMyProfile: jest.fn(),
  getRecentStudySessions: jest.fn(),
}));

const mockedHistory = getSessionHistory as jest.MockedFunction<typeof getSessionHistory>;
const mockedMetrics = getSessionMetrics as jest.MockedFunction<typeof getSessionMetrics>;

const item = (id: string, overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem => ({
  id, subject: 'Cálculo', mode: 'solo', state: 'completed',
  startedAt: '2026-10-16T13:00:00.000Z', endedAt: '2026-10-16T13:25:00.000Z',
  durationValidSeconds: 1500, xpAwarded: 250, discardedReason: null, cappedReason: null, cyclePosition: 2,
  ...overrides,
});

const week = (minutes: number[]): SessionMetrics => ({
  currentStreakDays: 2, longestStreakDays: 5, sessionsToday: 1, dailyGoal: 4, validSecondsToday: minutes[minutes.length - 1]! * 60,
  cadence: {
    windowStart: '2026-08-22', windowEnd: '2026-10-16',
    days: minutes.map((value, index) => ({
      date: `2026-10-${String(10 + index).padStart(2, '0')}`, sessionCount: value > 0 ? 1 : 0, validSeconds: value * 60, intensity: value > 0 ? 2 : 0,
    })),
  },
});

async function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ForgeHistory wide={false} /></QueryClientProvider>);
}

beforeEach(() => {
  mockedMetrics.mockResolvedValue(week([0, 25, 50, 0, 0, 75, 25]));
});
afterEach(() => { jest.clearAllMocks(); mockedHistory.mockReset(); mockedMetrics.mockReset(); });

describe('Histórico de hoje', () => {
  it('lists every outcome of the day with subject, times, valid focus, cycle and XP', async () => {
    mockedHistory.mockResolvedValue({
      date: '2026-10-16',
      items: [
        item('a'),
        item('b', { state: 'stopped_early', cyclePosition: null, xpAwarded: 80, durationValidSeconds: 480 }),
        item('c', { state: 'discarded', cyclePosition: null, xpAwarded: 0, discardedReason: 'heartbeat-gap', subject: null }),
        item('d', { state: 'stopped_early', cyclePosition: null, cappedReason: 'daily-limit' }),
        item('e', { state: 'cancelled', cyclePosition: null, xpAwarded: 0 }),
      ],
      nextCursor: null,
    });
    await renderHistory();

    const first = await screen.findByTestId('forge-history-item-a');
    expect(within(first).getByText('Cálculo')).toBeTruthy();
    expect(within(first).getByText('+250 XP')).toBeTruthy();
    expect(screen.getByTestId('forge-history-outcome-a')).toHaveTextContent('Foco 2 de 4');
    expect(screen.getByTestId('forge-history-outcome-b')).toHaveTextContent('Encerrada antes do fim');
    expect(screen.getByTestId('forge-history-outcome-c')).toHaveTextContent('Não contabilizada pelo antifraude');
    expect(within(screen.getByTestId('forge-history-item-c')).getByText('Sem matéria')).toBeTruthy();
    expect(within(screen.getByTestId('forge-history-item-c')).getByText('0 XP')).toBeTruthy();
    expect(screen.getByTestId('forge-history-outcome-d')).toHaveTextContent('XP limitado pelo teto diário');
    expect(screen.getByTestId('forge-history-outcome-e')).toHaveTextContent('Cancelada');
    expect(first.props.accessibilityLabel).toMatch(/^Cálculo\. .+ às .+\. 25 min de foco válido\. Foco 2 de 4\. 250 XP\.$/);
    expect(mockedHistory).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.objectContaining({ cursor: null }));
  });

  it('explains an empty day', async () => {
    mockedHistory.mockResolvedValue({ date: '2026-10-16', items: [], nextCursor: null });
    await renderHistory();

    expect(await screen.findByTestId('forge-history-empty')).toBeTruthy();
  });

  it('shows a retryable error and loads more with the cursor', async () => {
    mockedHistory.mockRejectedValueOnce(new ApiError('network'));
    await renderHistory();
    expect(await screen.findByTestId('forge-history-error')).toBeTruthy();

    mockedHistory.mockResolvedValueOnce({ date: '2026-10-16', items: [item('a')], nextCursor: 'next' });
    await fireEvent.press(within(screen.getByTestId('forge-history-error')).getByLabelText('Tentar novamente'));
    expect(await screen.findByTestId('forge-history-item-a')).toBeTruthy();

    mockedHistory.mockResolvedValueOnce({ date: '2026-10-16', items: [item('b')], nextCursor: null });
    await fireEvent.press(screen.getByTestId('forge-history-more'));
    expect(await screen.findByTestId('forge-history-item-b')).toBeTruthy();
    expect(mockedHistory).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ cursor: 'next' }));
    expect(screen.queryByTestId('forge-history-more')).toBeNull();
  });
});

describe('Foco na semana', () => {
  it('draws seven days with a text summary, a label per bar and today named in words', async () => {
    mockedHistory.mockResolvedValue({ date: '2026-10-16', items: [], nextCursor: null });
    await renderHistory();

    expect(await screen.findByTestId('forge-week-summary')).toHaveTextContent('Últimos 7 dias: 175 min de foco válido em 4 dias.');
    const today = screen.getByTestId('forge-week-day-2026-10-16');
    expect(today.props.accessibilityLabel).toBe('Hoje, 16/10: 25 min');
    expect(within(today).getByText('Hoje')).toBeTruthy();
    expect(screen.getByTestId('forge-week-day-2026-10-10').props.accessibilityLabel).toMatch(/: 0 min$/);
  });

  it('keeps the history when the week cannot be loaded', async () => {
    mockedHistory.mockResolvedValue({ date: '2026-10-16', items: [item('a')], nextCursor: null });
    mockedMetrics.mockReset();
    mockedMetrics.mockRejectedValue(new ApiError('server', { status: 500 }));
    await renderHistory();

    expect(await screen.findByTestId('forge-week-error')).toBeTruthy();
    expect(await screen.findByTestId('forge-history-item-a')).toBeTruthy();
  });
});

describe('helpers', () => {
  it('describes outcomes and the week', () => {
    expect(historyOutcome(item('x', { cyclePosition: 4 }))).toBe('Foco 4 de 4');
    expect(historyOutcome(item('x', { cyclePosition: null }))).toBe('Foco concluído');
    expect(weeklySummary(week([0, 0, 0, 0, 0, 0, 30]).cadence.days)).toBe('Últimos 7 dias: 30 min de foco válido em 1 dia.');
  });
});
