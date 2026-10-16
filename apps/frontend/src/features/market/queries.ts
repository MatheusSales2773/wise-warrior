import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getCoinBalance, getCoinStatement, listShopItems, listShopMissions } from './api';

/** Nested keys: invalidating `marketKeys.all` reaches the balance, the Extrato and both sections of the Loja. */
export const marketKeys = {
  all: ['market'] as const,
  balance: () => [...marketKeys.all, 'balance'] as const,
  statement: () => [...marketKeys.all, 'statement'] as const,
  shop: () => [...marketKeys.all, 'shop'] as const,
  missions: () => [...marketKeys.shop(), 'missions'] as const,
  items: () => [...marketKeys.shop(), 'items'] as const,
};

export const coinBalanceQueryOptions = () => queryOptions({
  queryKey: marketKeys.balance(),
  queryFn: ({ signal }) => getCoinBalance({ signal }),
  staleTime: 30_000,
});

export const coinStatementQueryOptions = () => infiniteQueryOptions({
  queryKey: marketKeys.statement(),
  queryFn: ({ pageParam, signal }) => getCoinStatement({ cursor: pageParam, signal }),
  initialPageParam: null as string | null,
  getNextPageParam: (page) => page.nextCursor,
  staleTime: 30_000,
});

export const shopMissionsQueryOptions = () => queryOptions({
  queryKey: marketKeys.missions(),
  queryFn: ({ signal }) => listShopMissions({ signal }),
  staleTime: 30_000,
});

export const shopItemsQueryOptions = () => queryOptions({
  queryKey: marketKeys.items(),
  queryFn: ({ signal }) => listShopItems({ signal }),
  staleTime: 30_000,
});
