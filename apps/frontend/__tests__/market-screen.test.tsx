import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform } from 'react-native';
import { ApiError } from '@/core/api/api-error';
import {
  getCoinBalance, listShopItems, listShopMissions, purchaseShopItem, purchaseShopMission, type ShopItem, type StoreMission,
} from '@/features/market/api';
import { MarketScreen } from '@/features/market/market-screen';
import { equipCosmeticItem } from '@/features/profile/api';
import { profileKeys } from '@/features/profile/queries';

jest.mock('@/features/market/api', () => ({
  getCoinBalance: jest.fn(),
  listShopMissions: jest.fn(),
  listShopItems: jest.fn(),
  purchaseShopMission: jest.fn(),
  purchaseShopItem: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({ equipCosmeticItem: jest.fn() }));

let mockParams: { secao?: string } = {};
const mockSetParams = jest.fn((next: { secao?: string }) => { mockParams = { ...mockParams, ...next }; });
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams, push: jest.fn() }),
}));

const mocked = {
  balance: getCoinBalance as jest.MockedFunction<typeof getCoinBalance>,
  missions: listShopMissions as jest.MockedFunction<typeof listShopMissions>,
  items: listShopItems as jest.MockedFunction<typeof listShopItems>,
  buyMission: purchaseShopMission as jest.MockedFunction<typeof purchaseShopMission>,
  buyItem: purchaseShopItem as jest.MockedFunction<typeof purchaseShopItem>,
  equip: equipCosmeticItem as jest.MockedFunction<typeof equipCosmeticItem>,
};

const mission = (overrides: Partial<StoreMission>): StoreMission => ({
  id: 'm', slug: 'm', name: 'Missão', description: 'Uma Missão.', imageUrl: null, price: 120,
  reward: { id: 'r', name: 'Selo dos Madrugadores', category: 'badge' }, state: 'purchasable', missing: 0, ...overrides,
});
const item = (overrides: Partial<ShopItem>): ShopItem => ({ id: 'i', category: 'avatar', name: 'Item', price: 60, state: 'purchasable', missing: 0, ...overrides });

const missions = [
  mission({ id: 'm1', name: 'Ruínas do Bibliotecário', price: 90, state: 'owned' }),
  mission({ id: 'm2', name: 'Cerco à Torre de Vidro', price: 120 }),
  mission({ id: 'm3', name: 'O Devorador de Prazos', price: 240, state: 'insufficient', missing: 108 }),
];
const items = [
  item({ id: 'i2', name: 'Capuz do Erudito', price: 60, state: 'owned' }),
  item({ id: 'i1', name: 'Manto da Vigília', price: 120 }),
  item({ id: 'i3', category: 'accessory', name: 'Cristal da Aurora', price: 150, state: 'insufficient', missing: 18 }),
];

function setViewport(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
}

async function renderMarket() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const view = await render(<QueryClientProvider client={client}><MarketScreen /></QueryClientProvider>);
  return { client, view };
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  setViewport(1440);
  mockParams = {};
  mocked.balance.mockResolvedValue(132);
  mocked.missions.mockResolvedValue(missions);
  mocked.items.mockResolvedValue(items);
  mocked.equip.mockResolvedValue(undefined);
});
afterEach(() => { Object.values(mocked).forEach((mock) => mock.mockReset()); mockSetParams.mockClear(); });

describe('Mercado on desktop', () => {
  it('leads with the purse and lists each Mission in its state', async () => {
    await renderMarket();

    expect((await screen.findByTestId('market-balance')).props.children).toBe('132');
    expect(screen.getByTestId('market-purse').props.accessibilityLabel).toBe('132 Moedas na bolsa');
    expect(await screen.findByTestId('market-mission-m1-owned')).toBeTruthy();
    expect(screen.getByTestId('market-mission-m2-buy')).toBeTruthy();
    const missing = within(screen.getByTestId('market-mission-m3-missing'));
    expect(missing.getByText('108')).toBeTruthy();
    expect(missing.getByText('9 focos completos de 25 min cobrem a diferença.')).toBeTruthy();
    expect(screen.getByTestId('market-mission-m3').props.accessibilityLabel).toBe('O Devorador de Prazos. 240 Moedas. Faltam 108 Moedas.');
  });

  it('confirms a Mission purchase with the balance after it, then shows the new balance', async () => {
    // The server debits the balance, so the refetch after the purchase reads it too.
    mocked.buyMission.mockImplementation(async () => { mocked.balance.mockResolvedValue(12); return { price: 120, balance: 12 }; });
    await renderMarket();

    await fireEvent.press(await screen.findByTestId('market-mission-m2-buy'));
    expect(screen.getByText('Comprar Cerco à Torre de Vidro?')).toBeTruthy();
    expect(screen.getByTestId('purchase-balance-after').props.children).toBe('12');

    await fireEvent.press(screen.getByTestId('purchase-confirm'));

    expect(mocked.buyMission).toHaveBeenCalledWith('m2');
    expect((await screen.findByTestId('purchase-done-title')).props.children).toEqual(['Cerco à Torre de Vidro', ' é ', 'sua']);
    expect(screen.getByText(/Restam 12 Moedas na bolsa\./)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('market-balance').props.children).toBe('12'));
    expect(screen.queryByTestId('purchase-equip')).toBeNull();
  });

  it('keeps the balance and explains a purchase the server refused', async () => {
    mocked.buyMission.mockRejectedValue(new ApiError('validation', { status: 422 }));
    await renderMarket();

    await fireEvent.press(await screen.findByTestId('market-mission-m2-buy'));
    await fireEvent.press(screen.getByTestId('purchase-confirm'));

    expect(await screen.findByText('Seu saldo mudou e não cobre mais esta compra. Nada foi cobrado.')).toBeTruthy();
    expect(screen.getByTestId('purchase-confirm').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('market-balance').props.children).toBe('132');
    await waitFor(() => expect(mocked.missions).toHaveBeenCalledTimes(2));
  });

  it('switches to Itens through the URL and previews the first item to buy', async () => {
    mockParams = { secao: 'itens' };
    await renderMarket();

    const preview = within(await screen.findByTestId('market-item-preview'));
    expect(preview.getByText('Manto da Vigília')).toBeTruthy();
    expect(preview.getByTestId('purchase-balance-after').props.children).toBe('12');

    await fireEvent.press(screen.getByTestId('market-tab-missoes'));
    expect(mockSetParams).toHaveBeenCalledWith({ secao: 'missoes' });
  });

  it('buys an item, refreshes the Inventário and equips it on request', async () => {
    mockParams = { secao: 'itens' };
    mocked.buyItem.mockResolvedValue({ price: 120, balance: 12 });
    const { client } = await renderMarket();
    client.setQueryData(profileKeys.cosmeticsCatalog(), []);

    await fireEvent.press(await screen.findByTestId('market-item-preview-buy'));
    await fireEvent.press(screen.getByTestId('purchase-confirm'));

    expect(mocked.buyItem).toHaveBeenCalledWith('i1');
    await screen.findByTestId('purchase-done-title');
    expect(client.getQueryState(profileKeys.cosmeticsCatalog())?.isInvalidated).toBe(true);

    await fireEvent.press(screen.getByTestId('purchase-equip'));
    expect(mocked.equip).toHaveBeenCalledWith('i1');
    expect(await screen.findByTestId('purchase-equipped')).toBeTruthy();
  });

  it('filters the items by category and shows what is missing for the selected one', async () => {
    mockParams = { secao: 'itens' };
    await renderMarket();

    await fireEvent.press(await screen.findByTestId('market-filter-accessory'));
    expect(screen.queryByTestId('market-item-i1')).toBeNull();
    await fireEvent.press(screen.getByTestId('market-item-i3'));

    const preview = within(screen.getByTestId('market-item-preview'));
    expect(preview.getByText('Cristal da Aurora')).toBeTruthy();
    expect(preview.getByTestId('market-item-preview-missing')).toBeTruthy();
    expect(preview.queryByTestId('market-item-preview-buy')).toBeNull();
  });

  it('says so when nothing is for sale', async () => {
    mocked.missions.mockResolvedValue([]);
    await renderMarket();

    expect(await screen.findByTestId('market-missions-empty')).toBeTruthy();
  });

  it('offers a retry when the Loja cannot load', async () => {
    mocked.missions.mockRejectedValueOnce(new ApiError('server', { status: 500 })).mockResolvedValue(missions);
    await renderMarket();

    expect(await screen.findByTestId('market-missions-error')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar novamente'));
    expect(await screen.findByTestId('market-mission-m2')).toBeTruthy();
  });
});

describe('Mercado on a phone', () => {
  beforeEach(() => setViewport(390));

  it('shows the purse as a chip that opens the Extrato', async () => {
    await renderMarket();

    const chip = await screen.findByTestId('market-purse');
    await waitFor(() => expect(screen.getByTestId('market-purse').props.accessibilityLabel).toBe('132 Moedas na bolsa'));
    expect(chip.props.accessibilityRole).toBe('link');
    expect(screen.getByTestId('market-layout-mobile')).toBeTruthy();
  });

  it('opens the sheet from a tile and explains a price the balance does not cover', async () => {
    mockParams = { secao: 'itens' };
    await renderMarket();

    await fireEvent.press(await screen.findByTestId('market-item-i2'));
    expect(screen.queryByTestId('purchase-dialog')).toBeNull();

    await fireEvent.press(screen.getByTestId('market-item-i3'));
    expect(within(screen.getByTestId('purchase-short')).getByText('Faltam 18 Moedas')).toBeTruthy();
    expect(screen.getByTestId('purchase-confirm').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('purchase-cancel'));
    expect(screen.queryByTestId('purchase-dialog')).toBeNull();

    await fireEvent.press(screen.getByTestId('market-item-i1'));
    expect(screen.getByTestId('purchase-balance-after').props.children).toBe('12');
  });
});
