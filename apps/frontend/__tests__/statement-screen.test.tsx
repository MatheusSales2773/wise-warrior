import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform } from 'react-native';
import { getCoinBalance, getCoinStatement, listShopItems, listShopMissions, type CoinStatementItem } from '@/features/market/api';
import { StatementScreen } from '@/features/market/statement-screen';

jest.mock('@/features/market/api', () => ({
  getCoinBalance: jest.fn(),
  getCoinStatement: jest.fn(),
  listShopMissions: jest.fn(),
  listShopItems: jest.fn(),
}));
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: jest.fn() }) }));

const mocked = {
  balance: getCoinBalance as jest.MockedFunction<typeof getCoinBalance>,
  statement: getCoinStatement as jest.MockedFunction<typeof getCoinStatement>,
  missions: listShopMissions as jest.MockedFunction<typeof listShopMissions>,
  items: listShopItems as jest.MockedFunction<typeof listShopItems>,
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const entry = (id: string, amount: number, balanceAfter: number, origin: CoinStatementItem['origin'], createdAt: string): CoinStatementItem => ({ id, amount, balanceAfter, origin, createdAt });

function setViewport(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
}

async function renderStatement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><StatementScreen /></QueryClientProvider>);
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  setViewport(1440);
  mocked.balance.mockResolvedValue(132);
  mocked.missions.mockResolvedValue([]);
  mocked.items.mockResolvedValue([{ id: 'i1', category: 'avatar', name: 'Manto da Vigília', price: 120, state: 'owned', missing: 0 }]);
});
afterEach(() => Object.values(mocked).forEach((mock) => mock.mockReset()));

describe('Extrato', () => {
  it('lists each movement with its origin, signed amount and the balance after it', async () => {
    mocked.statement.mockResolvedValue({
      items: [
        entry('e1', 12, 132, { type: 'study-session', ref: 's1' }, hoursAgo(0)),
        entry('e2', -120, 120, { type: 'purchase', ref: 'cosmetic:i1' }, hoursAgo(0)),
      ],
      nextCursor: null,
    });
    await renderStatement();

    expect((await screen.findByTestId('statement-balance')).props.children).toBe('132');
    const purchase = await screen.findByTestId('statement-entry-e2');
    expect(within(purchase).getByText('Compra · Manto da Vigília')).toBeTruthy();
    expect(screen.getByTestId('statement-amount-e2').props.children).toBe('−120');
    expect(screen.getByTestId('statement-amount-e1').props.children).toBe('+12');
    expect(purchase.props.accessibilityLabel).toMatch(/^Compra · Manto da Vigília, \d{2}:\d{2} · Item\. 120 Moedas saíram\. Saldo: 120 Moedas\.$/);
    expect(screen.getByText('Hoje')).toBeTruthy();
    expect(screen.getByTestId('statement-how-to-earn')).toBeTruthy();
  });

  it('loads older movements with the cursor of the last page', async () => {
    mocked.statement
      .mockResolvedValueOnce({ items: [entry('e1', 12, 102, { type: 'study-session', ref: 's1' }, hoursAgo(1))], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [entry('e0', 90, 90, { type: 'signup', ref: 'u1' }, hoursAgo(30))], nextCursor: null });
    await renderStatement();

    await fireEvent.press(await screen.findByTestId('statement-more'));

    expect(await screen.findByText('Moedas de boas-vindas')).toBeTruthy();
    expect(mocked.statement).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'c1' }));
    expect(screen.queryByTestId('statement-more')).toBeNull();
  });

  it('points to the Forja when nothing moved yet', async () => {
    mocked.statement.mockResolvedValue({ items: [], nextCursor: null });
    await renderStatement();

    expect(await screen.findByTestId('statement-empty')).toBeTruthy();
  });

  it('names a Moedas credit from a daily Objetivo as "Objetivo"', async () => {
    mocked.statement.mockResolvedValue({ items: [entry('e1', 15, 200, { type: 'objective', ref: 'four-sessions:2026-10-22' }, hoursAgo(0))], nextCursor: null });
    await renderStatement();

    const row = await screen.findByTestId('statement-entry-e1');
    expect(within(row).getByText('Objetivo')).toBeTruthy();
    expect(within(row).getByText(/Objetivo diário/)).toBeTruthy();
  });

  it('tells a weekly Objetivo credit from a daily one in the Extrato', async () => {
    mocked.statement.mockResolvedValue({ items: [entry('e1', 40, 240, { type: 'objective', ref: 'weekly:five-days:2026-10-19' }, hoursAgo(0))], nextCursor: null });
    await renderStatement();

    const row = await screen.findByTestId('statement-entry-e1');
    expect(within(row).getByText('Objetivo')).toBeTruthy();
    expect(within(row).getByText(/Objetivo semanal/)).toBeTruthy();
  });

  it('carries the balance after each line on a phone, where there is no column for it', async () => {
    setViewport(390);
    mocked.statement.mockResolvedValue({ items: [entry('e1', 50, 185, { type: 'raid-win', ref: 'r1' }, hoursAgo(0))], nextCursor: null });
    await renderStatement();

    const row = await screen.findByTestId('statement-entry-e1');
    expect(within(row).getByText(/saldo 185$/)).toBeTruthy();
    expect(screen.queryByTestId('statement-how-to-earn')).toBeNull();
  });
});
