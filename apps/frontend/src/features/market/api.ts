import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import type { CosmeticCategory } from '@/features/profile/api';

/* Moeda, Extrato e Loja (ADR-012, `docs/api/openapi.yaml`). */

export type CoinOriginType = 'study-session' | 'raid-win' | 'purchase' | 'signup' | 'migration' | 'objective';

/** `ref` da Compra é `mission:<id>` ou `cosmetic:<id>`; das demais origens, o id de quem gerou a movimentação. */
export type CoinOrigin = { type: CoinOriginType; ref: string };

export type CoinStatementItem = {
  id: string;
  /** Positivo para crédito, negativo para débito. */
  amount: number;
  balanceAfter: number;
  origin: CoinOrigin;
  createdAt: string;
};

export type CoinStatementPage = { items: CoinStatementItem[]; nextCursor: string | null };

/** `owned` já é do usuário; `purchasable` o saldo basta; `insufficient` faltam `missing` Moedas. */
export type ShopState = 'owned' | 'purchasable' | 'insufficient';

export type ShopItem = {
  id: string;
  category: CosmeticCategory;
  name: string;
  price: number;
  state: ShopState;
  missing: number;
};

export type StoreMissionReward = { id: string; name: string; category: CosmeticCategory };

export type StoreMission = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  /** O Cosmetic Item principal da Missão; a Recompensa de Raid soma ainda as Moedas de vitória. */
  reward: StoreMissionReward;
  state: ShopState;
  missing: number;
};

export type ShopPurchase = { price: number; balance: number };

export async function getCoinBalance({ signal }: { signal?: AbortSignal } = {}): Promise<number> {
  const response = await getAuthenticatedHttpClient().get<{ balance: number }>('/users/me/coins', { signal });
  return response.data.balance;
}

export async function getCoinStatement({ cursor, signal }: { cursor?: string | null; signal?: AbortSignal } = {}): Promise<CoinStatementPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await getAuthenticatedHttpClient().get<CoinStatementPage>(`/users/me/coins/statement${query}`, { signal });
  return response.data;
}

export async function listShopMissions({ signal }: { signal?: AbortSignal } = {}): Promise<StoreMission[]> {
  const response = await getAuthenticatedHttpClient().get<StoreMission[]>('/shop/missions', { signal });
  return response.data;
}

export async function listShopItems({ signal }: { signal?: AbortSignal } = {}): Promise<ShopItem[]> {
  const response = await getAuthenticatedHttpClient().get<ShopItem[]>('/shop/items', { signal });
  return response.data;
}

/** 404 fora de venda, 409 já possuída, 422 saldo insuficiente (nada muda), 429 Compras demais seguidas. */
export async function purchaseShopMission(missionId: string): Promise<ShopPurchase> {
  const response = await getAuthenticatedHttpClient().post<ShopPurchase>(`/shop/missions/${encodeURIComponent(missionId)}/purchase`);
  return { price: response.data.price, balance: response.data.balance };
}

/** O item vai para o Inventário, pronto para Equipar; as mesmas respostas de erro da Compra de Missão. */
export async function purchaseShopItem(itemId: string): Promise<ShopPurchase> {
  const response = await getAuthenticatedHttpClient().post<ShopPurchase>(`/shop/items/${encodeURIComponent(itemId)}/purchase`);
  return { price: response.data.price, balance: response.data.balance };
}
