import type { EquippedCosmeticItem, UserProfile } from '@/features/dashboard/api';
import type { CatalogCosmeticItem } from '@/features/profile/api';
import { describeUnlockCondition, orderCategoryItems } from '@/features/profile/formatters';
import type { HeroSpriteName, ItemSpriteName } from './sprites';

/*
 * Heroes are a static roster: the API has no hero selection yet, so availability is derived from level and plan.
 * Cosmetics come from the real Catalog (`GET /users/me/cosmetics`); this module only adds the pixel art and wording.
 */

export type HeroId = HeroSpriteName;

export type HeroDefinition = {
  id: HeroId;
  name: string;
  unlock: { kind: 'initial' } | { kind: 'level'; level: number } | { kind: 'premium' };
};

export const heroById: Record<HeroId, HeroDefinition> = {
  erudito: { id: 'erudito', name: 'Erudito', unlock: { kind: 'initial' } },
  guerreira: { id: 'guerreira', name: 'Guerreira', unlock: { kind: 'level', level: 10 } },
  arcanista: { id: 'arcanista', name: 'Arcanista', unlock: { kind: 'level', level: 20 } },
  paladino: { id: 'paladino', name: 'Paladino', unlock: { kind: 'premium' } },
};

export const heroes: readonly HeroDefinition[] = Object.values(heroById);

/** Every hero starts as the initial class until hero selection is persisted by the API. */
export const DEFAULT_HERO_ID: HeroId = 'erudito';

export type HeroStatus = 'equipped' | 'unlocked' | 'level-locked' | 'premium-locked';

type Progress = Pick<UserProfile, 'level' | 'planTier'>;

export function heroStatus(hero: HeroDefinition, progress: Progress, equippedHeroId: HeroId): HeroStatus {
  if (hero.id === equippedHeroId) return 'equipped';
  switch (hero.unlock.kind) {
    case 'initial': return 'unlocked';
    case 'level': return progress.level >= hero.unlock.level ? 'unlocked' : 'level-locked';
    case 'premium': return progress.planTier === 'premium' ? 'unlocked' : 'premium-locked';
  }
}

export function heroCaption(hero: HeroDefinition, status: HeroStatus): string {
  switch (hero.unlock.kind) {
    case 'initial': return 'Classe inicial';
    case 'level': return status === 'level-locked' ? `Libera no nível ${hero.unlock.level}` : `Liberada no nível ${hero.unlock.level}`;
    case 'premium': return 'Plano premium';
  }
}

export function isHeroAvailable(status: HeroStatus): boolean {
  return status === 'equipped' || status === 'unlocked';
}

export type EquipmentCategory = EquippedCosmeticItem['category'];

export type EquipmentCategoryDefinition = { id: EquipmentCategory; label: string; slotLabel: string; noun: string; description: string };

export const equipmentCategoryById: Record<EquipmentCategory, EquipmentCategoryDefinition> = {
  avatar: { id: 'avatar', label: 'Avatar', slotLabel: 'AVATAR', noun: 'avatar', description: 'Veste seu herói em todo o app' },
  badge: { id: 'badge', label: 'Badge', slotLabel: 'BADGE', noun: 'badge', description: 'Aparece ao lado do seu nome na guilda' },
  title: { id: 'title', label: 'Título', slotLabel: 'TÍTULO', noun: 'título', description: 'Aparece abaixo do seu nome em todo o app' },
  accessory: { id: 'accessory', label: 'Acessório', slotLabel: 'ACESSÓRIO', noun: 'acessório', description: 'Completa o visual do seu herói' },
};

export const equipmentCategories: readonly EquipmentCategoryDefinition[] = Object.values(equipmentCategoryById);

/** Pixel art per Catalog item (Figma "Sprites" page); unknown items fall back to their category's art. */
const spriteByName: Record<string, ItemSpriteName> = {
  'Capuz do Erudito': 'capuzDoErudito',
  'Manto da Vigília': 'mantoDaVigilia',
  Madrugador: 'madrugadorV',
  'Cem Sessões': 'cemSessoes',
  Aprendiz: 'estudanteCrepuscular',
  'Estudante Crepuscular': 'estudanteCrepuscular',
  'Mestre da Aurora': 'mestreDaAurora',
  'Selo dos Madrugadores': 'seloDosMadrugadores',
};

const spriteByCategory: Record<EquipmentCategory, ItemSpriteName> = {
  avatar: 'capuzDoErudito',
  badge: 'madrugadorV',
  title: 'estudanteCrepuscular',
  accessory: 'cristalDaAurora',
};

export function cosmeticSprite(item: Pick<EquippedCosmeticItem, 'category' | 'name'>): ItemSpriteName {
  return spriteByName[item.name] ?? spriteByCategory[item.category];
}

export type EquippedSlot = { itemId: string; name: string; sprite: ItemSpriteName };
export type EquippedItems = Record<EquipmentCategory, EquippedSlot | null>;

export function equippedItems(profile: Pick<UserProfile, 'equipped'>): EquippedItems {
  const slot = (category: EquipmentCategory): EquippedSlot | null => {
    const item = profile.equipped.find((entry) => entry.category === category);
    return item ? { itemId: item.itemId, name: item.name, sprite: cosmeticSprite(item) } : null;
  };
  return { avatar: slot('avatar'), badge: slot('badge'), title: slot('title'), accessory: slot('accessory') };
}

export type CosmeticAvailability = { kind: 'owned' } | { kind: 'premium' } | { kind: 'locked' };

export type CosmeticOption = {
  item: CatalogCosmeticItem;
  sprite: ItemSpriteName;
  availability: CosmeticAvailability;
  /** Second line under the name, e.g. "Título inicial" or "Alcance o nível 15". */
  caption: string;
};

function ownedCaption(item: CatalogCosmeticItem): string {
  const { unlockCondition } = item;
  if (unlockCondition.type === 'raid') return 'Conquistado em Raid';
  if (unlockCondition.level <= 1) return `${equipmentCategoryById[item.category].label} inicial`;
  return `Liberado no nível ${unlockCondition.level}`;
}

/**
 * The drawer's options for one category, in reading order: equipped, owned, premium, then locked
 * (develop's Catalog order). Premium items stay locked for free plans because equipping them is refused (ADR-007).
 */
export function optionsFor(catalog: readonly CatalogCosmeticItem[], category: EquipmentCategory, planTier: string): CosmeticOption[] {
  const premiumBlocked = (item: CatalogCosmeticItem) => item.requiresPremium && planTier !== 'premium';
  const rank = (option: CosmeticOption) => ({ owned: 0, premium: 1, locked: 2 })[option.availability.kind];
  return orderCategoryItems(catalog.filter((item) => item.category === category))
    .map((item): CosmeticOption => {
      if (premiumBlocked(item) && !item.equipped) return { item, sprite: cosmeticSprite(item), availability: { kind: 'premium' }, caption: 'Plano premium' };
      if (!item.unlocked) return { item, sprite: cosmeticSprite(item), availability: { kind: 'locked' }, caption: describeUnlockCondition(item.unlockCondition) };
      return { item, sprite: cosmeticSprite(item), availability: { kind: 'owned' }, caption: ownedCaption(item) };
    })
    .sort((left, right) => rank(left) - rank(right));
}
