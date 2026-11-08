import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Platform } from 'react-native';
import { applyPackGranted } from '@/core/realtime/realtime-client';
import { getCoinBalance, listShopItems, listShopMissions, purchaseShopItem, purchaseShopMission } from '@/features/market/api';
import { MarketScreen } from '@/features/market/market-screen';
import { listPacks, openPackCheckout, type BillingPack, type PackList } from '@/features/market/packs-api';
import { priceLabel } from '@/features/market/packs';
import { equipCosmeticItem } from '@/features/profile/api';
import { openStripePage } from '@/features/settings/billing';

jest.mock('@/features/market/api', () => ({
  getCoinBalance: jest.fn(),
  listShopMissions: jest.fn(),
  listShopItems: jest.fn(),
  purchaseShopMission: jest.fn(),
  purchaseShopItem: jest.fn(),
}));
jest.mock('@/features/market/packs-api', () => ({ listPacks: jest.fn(), openPackCheckout: jest.fn() }));
jest.mock('@/features/profile/api', () => ({ equipCosmeticItem: jest.fn() }));
jest.mock('@/features/settings/billing', () => ({ ...jest.requireActual('@/features/settings/billing'), openStripePage: jest.fn() }));

let mockParams: { secao?: string; checkout?: string } = {};
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
  packs: listPacks as jest.MockedFunction<typeof listPacks>,
  checkout: openPackCheckout as jest.MockedFunction<typeof openPackCheckout>,
  equip: equipCosmeticItem as jest.MockedFunction<typeof equipCosmeticItem>,
  openPage: openStripePage as jest.MockedFunction<typeof openStripePage>,
};

const dragon: BillingPack = {
  slug: 'dragao',
  name: 'Pacote do Dragão',
  description: 'Elmo, presa e amuleto forjados no fogo de um dragão. Ficam com você para sempre, em qualquer plano.',
  priceCents: 490,
  currency: 'brl',
  items: [
    { id: 'p1', name: 'Elmo de Escamas', category: 'avatar' },
    { id: 'p2', name: 'Presa do Dragão', category: 'weapon' },
    { id: 'p3', name: 'Amuleto de Brasa', category: 'accessory' },
  ],
  owned: false,
};
const available = (packs: BillingPack[] = [dragon]): PackList => ({ available: true, packs });

const httpError = (status: number, detail: string) => Object.assign(new Error(detail), { isAxiosError: true, response: { status, data: { detail } } });

function setViewport(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 } });
}

async function renderMarket() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const view = await render(<QueryClientProvider client={client}><MarketScreen /></QueryClientProvider>);
  return { client, view };
}

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel.split(',')[0]);

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, writable: true, value: 'web' });
  setViewport(1440);
  mockParams = {};
  mocked.balance.mockResolvedValue(132);
  mocked.missions.mockResolvedValue([]);
  mocked.items.mockResolvedValue([]);
  mocked.packs.mockResolvedValue(available());
  mocked.equip.mockResolvedValue(undefined);
});
afterEach(() => { Object.values(mocked).forEach((mock) => mock.mockReset()); mockSetParams.mockClear(); });

describe('the Pacotes tab', () => {
  it('shows the tabs Missões, Itens and Pacotes, in that order, while billing is available', async () => {
    await renderMarket();

    await screen.findByTestId('market-tab-pacotes');
    expect(tabNames()).toEqual(['Missões', 'Itens', 'Pacotes']);
  });

  it('shows only Missões and Itens while billing is not available', async () => {
    mocked.packs.mockResolvedValue({ available: false, packs: [] });
    await renderMarket();

    await waitFor(() => expect(mocked.packs).toHaveBeenCalled());
    await screen.findByTestId('market-tab-missoes');
    expect(tabNames()).toEqual(['Missões', 'Itens']);
    expect(screen.queryByTestId('market-tab-pacotes')).toBeNull();
  });

  it('hides the Pacotes tab and keeps Missões and Itens when the packs request fails', async () => {
    mocked.packs.mockRejectedValue(httpError(500, 'boom'));
    await renderMarket();

    await waitFor(() => expect(mocked.packs).toHaveBeenCalled());
    await screen.findByTestId('market-tab-itens');
    expect(tabNames()).toEqual(['Missões', 'Itens']);
    expect(screen.getByTestId('market-missions-empty')).toBeTruthy();
  });

  it('opens on Pacotes with ?secao=pacotes', async () => {
    mockParams = { secao: 'pacotes' };
    await renderMarket();

    expect(await screen.findByTestId('market-pack-dragao')).toBeTruthy();
    expect(screen.getByTestId('market-tab-pacotes').props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId('market-missions-empty')).toBeNull();
  });

  it('opens on Missões without secao, with the Pacotes tab present', async () => {
    await renderMarket();

    await screen.findByTestId('market-tab-pacotes');
    expect(screen.getByTestId('market-tab-missoes').props.accessibilityState).toEqual({ selected: true });
    expect(await screen.findByTestId('market-missions-empty')).toBeTruthy();
    expect(screen.queryByTestId('market-pack-dragao')).toBeNull();
  });

  it('opens on Missões with ?secao=pacotes while billing is not available', async () => {
    mockParams = { secao: 'pacotes' };
    mocked.packs.mockResolvedValue({ available: false, packs: [] });
    await renderMarket();

    expect(await screen.findByTestId('market-missions-empty')).toBeTruthy();
    expect(screen.getByTestId('market-tab-missoes').props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId('market-pack-dragao')).toBeNull();
  });

  it.each([['Missões', undefined], ['Itens', 'itens']])('keeps the Moedas balance in %s', async (_name, secao) => {
    mockParams = { secao };
    await renderMarket();

    expect(await screen.findByTestId('market-balance')).toBeTruthy();
    expect(screen.getByTestId('market-purse')).toBeTruthy();
  });

  it.each([[1440], [390]])('hides the Moedas balance and the Extrato link in Pacotes at %i px', async (width) => {
    setViewport(width);
    mockParams = { secao: 'pacotes' };
    await renderMarket();

    await screen.findByTestId('market-pack-dragao');
    expect(screen.queryByTestId('market-balance')).toBeNull();
    expect(screen.queryByTestId('market-purse')).toBeNull();
    expect(screen.queryByTestId('market-statement-link')).toBeNull();
  });

  it('mentions the Pacotes in the opening text while billing is available', async () => {
    await renderMarket();

    await screen.findByTestId('market-tab-pacotes');
    expect(screen.getByTestId('market-lede').props.children).toMatch(/^Troque as Moedas.*Pacotes/);
  });

  it('leaves the Pacotes out of the opening text while billing is not available', async () => {
    mocked.packs.mockResolvedValue({ available: false, packs: [] });
    await renderMarket();

    await waitFor(() => expect(mocked.packs).toHaveBeenCalled());
    await screen.findByTestId('market-tab-missoes');
    expect(screen.getByTestId('market-lede').props.children).toMatch(/^Troque as Moedas/);
    expect(screen.getByTestId('market-lede').props.children).not.toMatch(/Pacotes/);
  });
});

describe('the Pacote card', () => {
  beforeEach(() => { mockParams = { secao: 'pacotes' }; });

  it('shows the unowned Pacote with name, description, 3 items and Comprar por R$ 4,90', async () => {
    await renderMarket();

    const card = within(await screen.findByTestId('market-pack-dragao'));
    expect(card.getByText('Pacote do Dragão')).toBeTruthy();
    expect(card.getByText(dragon.description)).toBeTruthy();
    for (const name of ['Elmo de Escamas', 'Presa do Dragão', 'Amuleto de Brasa']) expect(card.getByText(name)).toBeTruthy();
    expect(card.getByRole('button', { name: 'Comprar por R$ 4,90' })).toBeTruthy();
    expect(card.queryByText('Adquirido')).toBeNull();
  });

  it('shows Adquirido and no buy button for an owned Pacote', async () => {
    mocked.packs.mockResolvedValue(available([{ ...dragon, owned: true }]));
    await renderMarket();

    const card = within(await screen.findByTestId('market-pack-dragao'));
    expect(card.getByText('Adquirido')).toBeTruthy();
    expect(card.queryByRole('button', { name: /Comprar/ })).toBeNull();
  });

  it('writes the price in reais from the cents', () => {
    expect(priceLabel(490)).toBe('R$ 4,90');
    expect(priceLabel(1290)).toBe('R$ 12,90');
    expect(priceLabel(100000)).toBe('R$ 1000,00');
  });

  it('previews the 3 items on the hero at once without persisting anything', async () => {
    await renderMarket();
    const card = within(await screen.findByTestId('market-pack-dragao'));
    expect(screen.queryByTestId('market-pack-preview')).toBeNull();

    await fireEvent.press(card.getByRole('button', { name: 'Prévia no herói' }));

    const preview = within(screen.getByTestId('market-pack-preview'));
    for (const id of ['p1', 'p2', 'p3']) expect(preview.getByTestId(`market-pack-preview-item-${id}`)).toBeTruthy();
    expect(mocked.equip).not.toHaveBeenCalled();
    expect(mocked.checkout).not.toHaveBeenCalled();
    expect(mocked.buyItem).not.toHaveBeenCalled();
    expect(mocked.buyMission).not.toHaveBeenCalled();
  });

  it('marks the button busy, requests the checkout of dragao and opens the url', async () => {
    let resolve!: (url: string) => void;
    mocked.checkout.mockReturnValue(new Promise((done) => { resolve = done; }));
    await renderMarket();

    await fireEvent.press(await screen.findByRole('button', { name: 'Comprar por R$ 4,90' }));
    expect(mocked.checkout).toHaveBeenCalledWith('dragao', expect.anything());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comprar por R$ 4,90' }).props.accessibilityState.busy).toBe(true));
    expect(mocked.openPage).not.toHaveBeenCalled();

    await act(async () => resolve('https://checkout.stripe.test/pack'));
    await waitFor(() => expect(mocked.openPage).toHaveBeenCalledWith('https://checkout.stripe.test/pack'));
  });

  it.each([
    [404, 'Pacote não encontrado'],
    [409, 'Você já tem este Pacote'],
    [502, 'Não foi possível abrir o pagamento'],
    [503, 'Pagamento indisponível no momento'],
  ])('shows the server message on %i and frees the button', async (status, detail) => {
    mocked.checkout.mockRejectedValue(httpError(status, detail));
    await renderMarket();

    await fireEvent.press(await screen.findByRole('button', { name: 'Comprar por R$ 4,90' }));

    expect(await screen.findByText(detail)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Comprar por R$ 4,90' }).props.accessibilityState.busy).toBeFalsy();
    expect(mocked.openPage).not.toHaveBeenCalled();
  });

  it('shows a generic line on any other failure and frees the button', async () => {
    mocked.checkout.mockRejectedValue(httpError(500, 'stack trace'));
    await renderMarket();

    await fireEvent.press(await screen.findByRole('button', { name: 'Comprar por R$ 4,90' }));

    expect(await screen.findByText('Não foi possível abrir o pagamento. Tente de novo.')).toBeTruthy();
    expect(screen.queryByText('stack trace')).toBeNull();
    expect(screen.getByRole('button', { name: 'Comprar por R$ 4,90' }).props.accessibilityState.busy).toBeFalsy();
  });
});

describe('coming back from the Checkout', () => {
  it('waits for the payment after checkout=success, then says the items arrive shortly', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      mockParams = { secao: 'pacotes', checkout: 'success' };
      await renderMarket();

      expect(await screen.findByText('Confirmando seu pagamento…')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(29_000); });
      expect(screen.getByText('Confirmando seu pagamento…')).toBeTruthy();
      expect(screen.queryByText('Pagamento recebido. Os itens chegam em instantes.')).toBeNull();
      await act(async () => { jest.advanceTimersByTime(1_000); });
      expect(await screen.findByText('Pagamento recebido. Os itens chegam em instantes.')).toBeTruthy();
      expect(screen.queryByText('Confirmando seu pagamento…')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows no waiting message with checkout=success when the Pacote is already owned', async () => {
    mockParams = { secao: 'pacotes', checkout: 'success' };
    mocked.packs.mockResolvedValue(available([{ ...dragon, owned: true }]));
    await renderMarket();

    await screen.findByText('Adquirido');
    expect(screen.queryByText('Confirmando seu pagamento…')).toBeNull();
    expect(screen.queryByTestId('market-pack-confirming')).toBeNull();
  });

  it('shows Adquirido and the Inventário notice when user:packGranted arrives', async () => {
    mockParams = { secao: 'pacotes', checkout: 'success' };
    const { client } = await renderMarket();
    expect(await screen.findByText('Confirmando seu pagamento…')).toBeTruthy();
    expect(screen.queryByText('Itens do Pacote do Dragão no seu Inventário')).toBeNull();

    mocked.packs.mockResolvedValue(available([{ ...dragon, owned: true }]));
    await act(async () => applyPackGranted(client));

    expect(await screen.findByText('Adquirido')).toBeTruthy();
    expect(screen.getByText('Itens do Pacote do Dragão no seu Inventário')).toBeTruthy();
    expect(screen.queryByText('Confirmando seu pagamento…')).toBeNull();
    expect(screen.queryByRole('button', { name: /Comprar/ })).toBeNull();
  });

  it('keeps the Inventário notice for a grant that arrives while another tab is open', async () => {
    mockParams = { secao: 'itens' };
    const { client, view } = await renderMarket();
    await screen.findByTestId('market-tab-pacotes');

    mocked.packs.mockResolvedValue(available([{ ...dragon, owned: true }]));
    await act(async () => applyPackGranted(client));
    await waitFor(() => expect(mocked.packs).toHaveBeenCalledTimes(2));

    mockParams = { secao: 'pacotes' };
    await view.rerender(<QueryClientProvider client={client}><MarketScreen /></QueryClientProvider>);

    expect(await screen.findByText('Adquirido')).toBeTruthy();
    expect(screen.getByText('Itens do Pacote do Dragão no seu Inventário')).toBeTruthy();
  });

  it('shows the Pacotes with no message after checkout=cancel', async () => {
    mockParams = { secao: 'pacotes', checkout: 'cancel' };
    await renderMarket();

    expect(await screen.findByRole('button', { name: 'Comprar por R$ 4,90' })).toBeTruthy();
    expect(screen.queryByText('Confirmando seu pagamento…')).toBeNull();
    expect(screen.queryByTestId('market-pack-failure')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
