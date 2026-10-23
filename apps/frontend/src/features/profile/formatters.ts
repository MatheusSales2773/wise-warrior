import type { CatalogCosmeticItem, DeviceSession, UnlockCondition } from './api';

/** Prefers the label the client sent at login; falls back to a coarse reading of the user agent. */
export function describeDevice(device: Pick<DeviceSession, 'deviceLabel' | 'userAgent'>): string {
  const label = device.deviceLabel?.trim();
  if (label) return label;
  const agent = device.userAgent ?? '';
  if (/iphone|ipad|ios/i.test(agent)) return 'Dispositivo iOS';
  if (/android/i.test(agent)) return 'Dispositivo Android';
  if (/windows|macintosh|linux/i.test(agent)) return 'Navegador no computador';
  return 'Dispositivo desconhecido';
}

export function describeUnlockCondition(item: Pick<CatalogCosmeticItem, 'unlockCondition' | 'forSale'>): string {
  const condition: UnlockCondition = item.unlockCondition;
  if (condition.type === 'level') return `Alcance o nível ${condition.level}`;
  if (condition.type === 'purchase') return item.forSale ? 'À venda na Loja' : 'Fora de venda';
  if (condition.type === 'sessions') return `Conclua ${condition.count} Study Sessions`;
  if (condition.type === 'early-sessions') return `Conclua ${condition.count} Study Sessions antes das 7h`;
  return condition.slug === '*' ? 'Conclua uma Raid com sua Guilda' : `Conclua a Raid ${condition.slug}`;
}

export type CosmeticItemState = 'equipped' | 'unlocked' | 'lockedByLevel' | 'lockedBySessions' | 'lockedByPurchase' | 'lockedByRaid' | 'offSale';

export function cosmeticItemState(item: CatalogCosmeticItem): CosmeticItemState {
  if (item.equipped) return 'equipped';
  if (item.unlocked) return 'unlocked';
  switch (item.unlockCondition.type) {
    case 'level': return 'lockedByLevel';
    case 'purchase': return item.forSale ? 'lockedByPurchase' : 'offSale';
    case 'raid': return 'lockedByRaid';
    case 'sessions':
    case 'early-sessions': return 'lockedBySessions';
  }
}

const STATE_ORDER: Record<CosmeticItemState, number> = { equipped: 0, unlocked: 1, lockedByLevel: 2, lockedBySessions: 3, lockedByPurchase: 4, lockedByRaid: 5, offSale: 6 };

function conditionLevel(item: CatalogCosmeticItem): number {
  return item.unlockCondition.type === 'level' ? item.unlockCondition.level : 0;
}

/** Ordem dentro de uma categoria: equipado, desbloqueados, bloqueados pelo nível da condição, à venda, Raids e, por último, Fora de venda. */
export function orderCategoryItems(items: CatalogCosmeticItem[]): CatalogCosmeticItem[] {
  return [...items].sort((a, b) =>
    STATE_ORDER[cosmeticItemState(a)] - STATE_ORDER[cosmeticItemState(b)]
    || (cosmeticItemState(a) === 'lockedByLevel' ? conditionLevel(a) - conditionLevel(b) : 0));
}

/** Meta de uma categoria sem item desbloqueado (UC04 A01): quanto falta para o próximo item por nível. */
export function describeNextUnlock(items: CatalogCosmeticItem[], level: number): string {
  const next = orderCategoryItems(items).find((item) => cosmeticItemState(item) === 'lockedByLevel');
  if (!next) return describeRemainingSources(items);
  const missing = conditionLevel(next) - level;
  if (missing <= 0) return `${next.name} já está liberado para o seu nível.`;
  return missing === 1
    ? `Falta 1 nível para desbloquear ${next.name}.`
    : `Faltam ${missing} níveis para desbloquear ${next.name}.`;
}

/** Sem item por nível à frente, diz de onde vêm os que restam: Raids, Loja ou nenhum lugar (Fora de venda). */
function describeRemainingSources(items: CatalogCosmeticItem[]): string {
  const states = new Set(items.map(cosmeticItemState));
  const sessions = states.has('lockedBySessions');
  const raids = states.has('lockedByRaid');
  const shop = states.has('lockedByPurchase');
  if (sessions && !raids && !shop) return 'Os itens desta categoria são conquistados estudando.';
  if (raids && shop) return 'Os itens desta categoria são conquistados em Raids com sua Guilda ou comprados na Loja.';
  if (raids) return 'Os itens desta categoria são conquistados em Raids com sua Guilda.';
  if (shop) return 'Os itens desta categoria são comprados na Loja.';
  return 'Os itens desta categoria estão fora de venda.';
}
