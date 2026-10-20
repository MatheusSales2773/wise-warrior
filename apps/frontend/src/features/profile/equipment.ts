import type { UserProfile } from '@/features/dashboard/api';
import type { CatalogCosmeticItem } from './api';

function withTitle(profile: UserProfile, equipped: UserProfile['equipped']): UserProfile {
  return { ...profile, equipped, title: equipped.find((item) => item.category === 'title')?.name ?? null };
}

/** O perfil como ficaria com `item` equipado: troca o item da categoria e mantém o resto. */
export function profileWithEquipped(profile: UserProfile, item: CatalogCosmeticItem): UserProfile {
  return withTitle(profile, [
    ...profile.equipped.filter((equipped) => equipped.category !== item.category),
    { category: item.category, itemId: item.id, name: item.name },
  ]);
}

export function profileWithoutEquipped(profile: UserProfile, item: CatalogCosmeticItem): UserProfile {
  return withTitle(profile, profile.equipped.filter((equipped) => equipped.itemId !== item.id));
}

export function catalogWithEquipped(catalog: CatalogCosmeticItem[], item: CatalogCosmeticItem): CatalogCosmeticItem[] {
  return catalog.map((entry) => (entry.category === item.category ? { ...entry, equipped: entry.id === item.id } : entry));
}

export function catalogWithoutEquipped(catalog: CatalogCosmeticItem[], item: CatalogCosmeticItem): CatalogCosmeticItem[] {
  return catalog.map((entry) => (entry.id === item.id ? { ...entry, equipped: false } : entry));
}
