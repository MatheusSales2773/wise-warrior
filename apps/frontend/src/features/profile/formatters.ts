import type { CatalogCosmeticItem, DeviceSession, UnlockCondition } from './api';

export function formatPlanTier(planTier: string): string {
  return planTier === 'premium' ? 'Plano premium' : 'Plano gratuito';
}

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

export function describeUnlockCondition(condition: UnlockCondition): string {
  if (condition.type === 'level') return `Alcance o nível ${condition.level}`;
  return condition.slug === '*' ? 'Conclua uma Raid com sua Guilda' : `Conclua a Raid ${condition.slug}`;
}

export type CosmeticItemState = 'equipped' | 'unlocked' | 'lockedByLevel' | 'lockedByRaid';

export function cosmeticItemState(item: CatalogCosmeticItem): CosmeticItemState {
  if (item.equipped) return 'equipped';
  if (item.unlocked) return 'unlocked';
  return item.unlockCondition.type === 'level' ? 'lockedByLevel' : 'lockedByRaid';
}

const STATE_ORDER: Record<CosmeticItemState, number> = { equipped: 0, unlocked: 1, lockedByLevel: 2, lockedByRaid: 3 };

function conditionLevel(item: CatalogCosmeticItem): number {
  return item.unlockCondition.type === 'level' ? item.unlockCondition.level : 0;
}

/** Ordem dentro de uma categoria: equipado, desbloqueados, bloqueados pelo nível da condição e, por último, os de Raid. */
export function orderCategoryItems(items: CatalogCosmeticItem[]): CatalogCosmeticItem[] {
  return [...items].sort((a, b) =>
    STATE_ORDER[cosmeticItemState(a)] - STATE_ORDER[cosmeticItemState(b)]
    || (cosmeticItemState(a) === 'lockedByLevel' ? conditionLevel(a) - conditionLevel(b) : 0));
}

/** Meta de uma categoria sem item desbloqueado (UC04 A01): quanto falta para o próximo item por nível. */
export function describeNextUnlock(items: CatalogCosmeticItem[], level: number): string {
  const next = orderCategoryItems(items).find((item) => cosmeticItemState(item) === 'lockedByLevel');
  if (!next) return 'Os itens desta categoria são conquistados em Raids com sua Guilda.';
  const missing = conditionLevel(next) - level;
  if (missing <= 0) return `${next.name} já está liberado para o seu nível.`;
  return missing === 1
    ? `Falta 1 nível para desbloquear ${next.name}.`
    : `Faltam ${missing} níveis para desbloquear ${next.name}.`;
}
