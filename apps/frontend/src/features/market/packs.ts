import { queryOptions } from '@tanstack/react-query';
import { listPacks } from './packs-api';

export const packKeys = { all: ['billing', 'packs'] as const };

export const packsQueryOptions = () => queryOptions({
  queryKey: packKeys.all,
  queryFn: ({ signal }) => listPacks({ signal }),
  staleTime: 30_000,
  retry: false,
});

/** 490 → "R$ 4,90". Only `brl` is sold (ADR-015), so the symbol is fixed. */
export function priceLabel(priceCents: number): string {
  return `R$ ${(priceCents / 100).toFixed(2).replace('.', ',')}`;
}
