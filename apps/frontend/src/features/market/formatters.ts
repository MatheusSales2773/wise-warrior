import { equipmentCategories } from '@/features/character/catalog';
import type { CosmeticCategory } from '@/features/profile/api';
import { isApiError } from '@/core/api/api-error';
import type { CoinStatementItem, ShopItem, StoreMission } from './api';

/** ADR-012: 1 Moeda a cada 2 min de foco válido, então um foco completo de 25 min rende 12. */
export const COINS_PER_FULL_FOCUS = 12;
/** ADR-012: Moedas de vitória pagas a cada Participante de uma Raid vencida. */
export const RAID_WIN_COINS = 50;

const WHOLE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

export function formatCoins(value: number): string {
  return WHOLE.format(value);
}

export function coinsLabel(value: number): string {
  return `${formatCoins(value)} ${Math.abs(value) === 1 ? 'Moeda' : 'Moedas'}`;
}

/** Signed amount for the Extrato: `+12` or `−120` (true minus sign, so it lines up with the digits). */
export function formatSignedCoins(amount: number): string {
  return amount < 0 ? `−${formatCoins(-amount)}` : `+${formatCoins(amount)}`;
}

/** How many full 25-minute focuses cover what is missing. */
export function focusesToAfford(missing: number): number {
  return Math.ceil(Math.max(0, missing) / COINS_PER_FULL_FOCUS);
}

export function missingHint(missing: number): string {
  const focuses = focusesToAfford(missing);
  return `${focuses} ${focuses === 1 ? 'foco completo de 25 min cobre' : 'focos completos de 25 min cobrem'} a diferença.`;
}

/** Category order follows the Personagem screen; inside a category, cheapest first. */
export function orderShopItems(items: readonly ShopItem[]): ShopItem[] {
  const rank = new Map(equipmentCategories.map((category, index) => [category.id, index]));
  return [...items].sort((a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) || a.price - b.price || a.name.localeCompare(b.name, 'pt-BR'));
}

export function presentCategories(items: readonly ShopItem[]): CosmeticCategory[] {
  return equipmentCategories.map((category) => category.id).filter((id) => items.some((item) => item.category === id));
}

/** Names the Compras in the Extrato from what the Loja already loaded; unknown ids keep the generic label. */
export function purchaseNames(missions: readonly StoreMission[] | undefined, items: readonly ShopItem[] | undefined): Map<string, string> {
  const names = new Map<string, string>();
  missions?.forEach((mission) => names.set(`mission:${mission.id}`, mission.name));
  items?.forEach((item) => names.set(`cosmetic:${item.id}`, item.name));
  return names;
}

export function statementTitle(entry: CoinStatementItem, names: ReadonlyMap<string, string> = new Map()): string {
  switch (entry.origin.type) {
    case 'study-session': return 'Sessão de estudo';
    case 'raid-win': return 'Vitória na Raid';
    case 'signup': return 'Moedas de boas-vindas';
    case 'migration': return 'Ajuste de saldo';
    case 'objective': return 'Objetivo';
    case 'purchase': {
      const name = names.get(entry.origin.ref);
      return name ? `Compra · ${name}` : 'Compra na Loja';
    }
  }
}

export function statementDetail(entry: CoinStatementItem): string {
  const time = TIME.format(new Date(entry.createdAt));
  switch (entry.origin.type) {
    case 'purchase': return `${time} · ${entry.origin.ref.startsWith('mission:') ? 'Missão' : 'Item'}`;
    case 'raid-win': return `${time} · Recompensa de Raid`;
    case 'signup': return `${time} · Ao entrar na fortaleza`;
    case 'objective': return `${time} · ${entry.origin.ref.startsWith('weekly:') ? 'Objetivo semanal' : 'Objetivo diário'}`;
    default: return time;
  }
}

export function statementEntryLabel(entry: CoinStatementItem, names?: ReadonlyMap<string, string>): string {
  const verb = entry.amount < 0 ? 'saíram' : 'entraram';
  return `${statementTitle(entry, names)}, ${statementDetail(entry)}. ${coinsLabel(Math.abs(entry.amount))} ${verb}. Saldo: ${coinsLabel(entry.balanceAfter)}.`;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Hoje", "Ontem", the weekday inside the last week, then the date. */
export function statementDayLabel(at: string, now: Date = new Date()): string {
  const date = new Date(at);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days > 1 && days < 7) {
    const weekday = WEEKDAY.format(date);
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return DAY_MONTH.format(date).replace('.', '');
}

export type StatementGroup = { key: string; label: string; date: string; entries: CoinStatementItem[] };

/** Groups the newest-first Extrato by the device's local day. */
export function groupStatement(entries: readonly CoinStatementItem[], now: Date = new Date()): StatementGroup[] {
  const groups: StatementGroup[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = localDayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label: statementDayLabel(entry.createdAt, now), date: DAY_MONTH.format(date).replace('.', ''), entries: [entry] });
  }
  return groups;
}

export type PurchaseFailure = { title: string; message: string };

export function purchaseFailure(error: unknown, name: string): PurchaseFailure {
  const status = isApiError(error) ? error.status : undefined;
  if (status === 409) return { title: 'Já é seu', message: `${name} já estava com você. Nada foi cobrado.` };
  if (status === 422) return { title: 'Moedas insuficientes', message: 'Seu saldo mudou e não cobre mais esta compra. Nada foi cobrado.' };
  if (status === 404) return { title: 'Fora de venda', message: `${name} não está mais à venda. Nada foi cobrado.` };
  if (status === 429) return { title: 'Muitas compras seguidas', message: 'Espere um instante e tente de novo. Nada foi cobrado.' };
  // The request may have reached the server before the failure, so the user checks the Extrato before trying again.
  return { title: 'Não foi possível confirmar a compra', message: 'Confira seu saldo e o Extrato antes de tentar de novo.' };
}
