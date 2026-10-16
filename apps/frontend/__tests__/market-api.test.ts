import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { ApiError } from '@/core/api/api-error';
import {
  getCoinBalance, getCoinStatement, listShopItems, listShopMissions, purchaseShopItem, purchaseShopMission,
  type CoinStatementItem, type ShopItem,
} from '@/features/market/api';
import {
  focusesToAfford, formatSignedCoins, groupStatement, missingHint, orderShopItems, presentCategories, purchaseFailure,
  purchaseNames, statementDayLabel, statementEntryLabel, statementTitle,
} from '@/features/market/formatters';

jest.mock('@/core/api/api-client', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const client = (methods: Record<string, jest.Mock>) => (getAuthenticatedHttpClient as jest.Mock).mockReturnValue(methods);

describe('market API', () => {
  it('reads the balance and forwards the abort signal', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: { balance: 132 } });
    client({ get });
    const signal = new AbortController().signal;

    await expect(getCoinBalance({ signal })).resolves.toBe(132);
    expect(get).toHaveBeenCalledWith('/users/me/coins', { signal });
  });

  it('pages the Extrato with the opaque cursor', async () => {
    const page = { items: [], nextCursor: null };
    const get = jest.fn().mockResolvedValue({ status: 200, data: page });
    client({ get });

    await expect(getCoinStatement()).resolves.toEqual(page);
    expect(get).toHaveBeenLastCalledWith('/users/me/coins/statement', { signal: undefined });
    await getCoinStatement({ cursor: 'a+b/c' });
    expect(get).toHaveBeenLastCalledWith('/users/me/coins/statement?cursor=a%2Bb%2Fc', { signal: undefined });
  });

  it('lists both sections of the Loja', async () => {
    const get = jest.fn().mockResolvedValue({ status: 200, data: [] });
    client({ get });

    await listShopMissions();
    await listShopItems();
    expect(get.mock.calls.map(([url]) => url)).toEqual(['/shop/missions', '/shop/items']);
  });

  it('buys a Mission or an item and returns the new balance', async () => {
    const post = jest.fn().mockResolvedValue({ status: 201, data: { missionId: 'm 1', itemId: 'i1', price: 120, balance: 12 } });
    client({ post });

    await expect(purchaseShopMission('m 1')).resolves.toEqual({ price: 120, balance: 12 });
    await expect(purchaseShopItem('i1')).resolves.toEqual({ price: 120, balance: 12 });
    expect(post.mock.calls.map(([url]) => url)).toEqual(['/shop/missions/m%201/purchase', '/shop/items/i1/purchase']);
  });

  it('lets a refused purchase through untouched', async () => {
    const failure = new ApiError('validation', { status: 422 });
    client({ post: jest.fn().mockRejectedValue(failure) });
    await expect(purchaseShopItem('i1')).rejects.toBe(failure);
  });
});

const entry = (overrides: Partial<CoinStatementItem> = {}): CoinStatementItem => ({
  id: 'e1', amount: 12, balanceAfter: 132, origin: { type: 'study-session', ref: 's1' }, createdAt: '2026-10-16T14:32:00', ...overrides,
});
const item = (overrides: Partial<ShopItem>): ShopItem => ({ id: 'i', category: 'avatar', name: 'Item', price: 60, state: 'purchasable', missing: 0, ...overrides });

describe('market formatters', () => {
  it('signs amounts with a true minus and counts the focuses that cover what is missing', () => {
    expect(formatSignedCoins(12)).toBe('+12');
    expect(formatSignedCoins(-1200)).toBe('−1.200');
    expect(focusesToAfford(108)).toBe(9);
    expect(focusesToAfford(12)).toBe(1);
    expect(focusesToAfford(0)).toBe(0);
    expect(missingHint(5)).toBe('1 foco completo de 25 min cobre a diferença.');
    expect(missingHint(30)).toBe('3 focos completos de 25 min cobrem a diferença.');
  });

  it('orders items by the Personagem categories, then by price', () => {
    const ordered = orderShopItems([
      item({ id: 'a', category: 'accessory', price: 30 }),
      item({ id: 'b', category: 'avatar', price: 120 }),
      item({ id: 'c', category: 'avatar', price: 60 }),
      item({ id: 'd', category: 'badge', price: 45 }),
    ]);
    expect(ordered.map(({ id }) => id)).toEqual(['c', 'b', 'd', 'a']);
    expect(presentCategories(ordered)).toEqual(['avatar', 'badge', 'accessory']);
  });

  it('names each origin of the Extrato, including the Compras the Loja knows', () => {
    const names = purchaseNames([{ id: 'm1', name: 'Cerco à Torre de Vidro' } as never], [{ id: 'i1', name: 'Manto da Vigília' } as never]);

    expect(statementTitle(entry())).toBe('Sessão de estudo');
    expect(statementTitle(entry({ origin: { type: 'raid-win', ref: 'r1' } }))).toBe('Vitória na Raid');
    expect(statementTitle(entry({ origin: { type: 'signup', ref: 'u1' } }))).toBe('Moedas de boas-vindas');
    expect(statementTitle(entry({ origin: { type: 'migration', ref: 'x' } }))).toBe('Ajuste de saldo');
    expect(statementTitle(entry({ origin: { type: 'purchase', ref: 'mission:m1' } }), names)).toBe('Compra · Cerco à Torre de Vidro');
    expect(statementTitle(entry({ origin: { type: 'purchase', ref: 'cosmetic:i1' } }), names)).toBe('Compra · Manto da Vigília');
    expect(statementTitle(entry({ origin: { type: 'purchase', ref: 'cosmetic:gone' } }), names)).toBe('Compra na Loja');
    expect(statementEntryLabel(entry({ amount: -120, balanceAfter: 12, origin: { type: 'purchase', ref: 'cosmetic:i1' } }), names))
      .toBe('Compra · Manto da Vigília, 14:32 · Item. 120 Moedas saíram. Saldo: 12 Moedas.');
  });

  it('groups the Extrato by local day with relative labels', () => {
    const now = new Date('2026-10-16T18:00:00');
    expect(statementDayLabel('2026-10-16T08:00:00', now)).toBe('Hoje');
    expect(statementDayLabel('2026-10-15T23:59:00', now)).toBe('Ontem');
    expect(statementDayLabel('2026-10-13T10:00:00', now)).toBe('Terça-feira');
    expect(statementDayLabel('2026-10-01T10:00:00', now)).toBe('1 de out');

    const groups = groupStatement([
      entry({ id: 'a', createdAt: '2026-10-16T14:00:00' }),
      entry({ id: 'b', createdAt: '2026-10-16T09:00:00' }),
      entry({ id: 'c', createdAt: '2026-10-15T21:00:00' }),
    ], now);
    expect(groups.map((group) => [group.label, group.entries.map(({ id }) => id)])).toEqual([['Hoje', ['a', 'b']], ['Ontem', ['c']]]);
  });

  it('explains each refused purchase without promising what the server did not confirm', () => {
    expect(purchaseFailure(new ApiError('conflict', { status: 409 }), 'Manto').title).toBe('Já é seu');
    expect(purchaseFailure(new ApiError('validation', { status: 422 }), 'Manto').title).toBe('Moedas insuficientes');
    expect(purchaseFailure(new ApiError('unexpected', { status: 404 }), 'Manto').message).toBe('Manto não está mais à venda. Nada foi cobrado.');
    expect(purchaseFailure(new ApiError('rate-limited', { status: 429 }), 'Manto').title).toBe('Muitas compras seguidas');
    expect(purchaseFailure(new ApiError('network'), 'Manto')).toEqual({
      title: 'Não foi possível confirmar a compra',
      message: 'Confira seu saldo e o Extrato antes de tentar de novo.',
    });
  });
});
