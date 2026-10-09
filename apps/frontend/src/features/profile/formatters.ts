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

function displayRank(item: CatalogCosmeticItem): [number, number] {
  if (item.equipped) return [0, 0];
  if (item.unlocked) return [1, 0];
  if (item.unlockCondition.type === 'level') return [2, item.unlockCondition.level];
  return [3, 0];
}

/** Ordem dentro de uma categoria: equipado, desbloqueados, bloqueados pelo nível da condição e, por último, os de Raid. */
export function orderCategoryItems(items: CatalogCosmeticItem[]): CatalogCosmeticItem[] {
  return [...items].sort((a, b) => {
    const [groupA, levelA] = displayRank(a);
    const [groupB, levelB] = displayRank(b);
    return groupA - groupB || levelA - levelB;
  });
}

/** Meta de uma categoria sem item desbloqueado (UC04 A01): quanto falta para o próximo item por nível. */
export function describeNextUnlock(items: CatalogCosmeticItem[], level: number): string {
  const next = items
    .flatMap((item) => (item.unlockCondition.type === 'level' ? [{ name: item.name, level: item.unlockCondition.level }] : []))
    .filter((item) => item.level > level)
    .sort((a, b) => a.level - b.level)[0];
  if (!next) return 'Os itens desta categoria são conquistados em Raids com sua Guilda.';
  const missing = next.level - level;
  return missing === 1
    ? `Falta 1 nível para desbloquear ${next.name}.`
    : `Faltam ${missing} níveis para desbloquear ${next.name}.`;
}
