import { parseUnlockCondition } from './unlock-condition';

/** Faixa de preço dos Cosmetic Items À venda (ADR-012). */
export const SALE_PRICE_MIN = 30;
export const SALE_PRICE_MAX = 300;

/** Os campos do Cosmetic Item que decidem se ele pode estar À venda. */
export interface SaleListing {
  category: 'avatar' | 'badge' | 'title' | 'accessory';
  forSale: boolean;
  price: number | null;
  unlockCondition: string;
  requiresPremium: boolean;
}

/**
 * Por que o item não pode estar À venda, ou `null` quando pode (ou quando não está À venda). Só a Condição de
 * desbloqueio `purchase` vende, e o Badge nunca (é sempre conquistado): Recompensas de Raid (`raid:*`) e itens de nível (`level:*`) nunca, e Item premium
 * também não. A mesma regra vira CHECK na migration, para valer também fora da aplicação.
 */
export function forSaleViolation(item: SaleListing): string | null {
  if (!item.forSale) return null;
  if (item.category === 'badge') return 'Badge nunca pode estar À venda';
  if (parseUnlockCondition(item.unlockCondition)?.type !== 'purchase') {
    return 'Só um item com Condição de desbloqueio de compra pode estar À venda';
  }
  if (item.requiresPremium) return 'Item premium não pode estar À venda';
  const { price } = item;
  if (price === null || !Number.isInteger(price) || price < SALE_PRICE_MIN || price > SALE_PRICE_MAX) {
    return `O preço de um item À venda vai de ${SALE_PRICE_MIN} a ${SALE_PRICE_MAX} Moedas`;
  }
  return null;
}
