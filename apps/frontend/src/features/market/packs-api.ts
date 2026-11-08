import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import type { CosmeticCategory } from '@/features/profile/api';

/* Pacotes pagos com dinheiro (ADR-015, `docs/api/openapi.yaml`). */

export type PackItem = { id: string; name: string; category: CosmeticCategory };

export type BillingPack = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  items: PackItem[];
  /** O usuário já pagou o Pacote: os itens são dele para sempre, em qualquer plano. */
  owned: boolean;
};

/** `available: false` quando a cobrança não está configurada; a Loja então esconde a seção. */
export type PackList = { available: boolean; packs: BillingPack[] };

export async function listPacks({ signal }: { signal?: AbortSignal } = {}): Promise<PackList> {
  return (await getAuthenticatedHttpClient().get<PackList>('/billing/packs', { signal })).data;
}

/** `POST /billing/packs/:slug/checkout`: a página do Stripe a abrir. 404, 409, 502 e 503 trazem a mensagem do servidor. */
export async function openPackCheckout(slug: string): Promise<string> {
  return (await getAuthenticatedHttpClient().post<{ url: string }>(`/billing/packs/${encodeURIComponent(slug)}/checkout`, {})).data.url;
}
