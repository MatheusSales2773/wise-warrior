import type { UserProfile } from '@/features/dashboard/api';
import type { HeroSpriteName, ItemSpriteName } from './sprites';

/*
 * Static catalog for the Personagem screen. The API exposes level, XP, title and plan tier, but
 * no hero roster or cosmetic inventory yet, so availability is derived from those fields here.
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

export type EquipmentCategory = 'avatar' | 'badge' | 'title' | 'accessory';

export type EquipmentCategoryDefinition = { id: EquipmentCategory; label: string; slotLabel: string; noun: string; description: string };

export const equipmentCategoryById: Record<EquipmentCategory, EquipmentCategoryDefinition> = {
  avatar: { id: 'avatar', label: 'Avatar', slotLabel: 'AVATAR', noun: 'avatar', description: 'Veste seu herói em todo o app' },
  badge: { id: 'badge', label: 'Badge', slotLabel: 'BADGE', noun: 'badge', description: 'Aparece ao lado do seu nome na guilda' },
  title: { id: 'title', label: 'Título', slotLabel: 'TÍTULO', noun: 'título', description: 'Aparece abaixo do seu nome em todo o app' },
  accessory: { id: 'accessory', label: 'Acessório', slotLabel: 'ACESSÓRIO', noun: 'acessório', description: 'Completa o visual do seu herói' },
};

export const equipmentCategories: readonly EquipmentCategoryDefinition[] = Object.values(equipmentCategoryById);

export type CosmeticAvailability = { kind: 'owned'; caption: string } | { kind: 'premium' } | { kind: 'locked'; caption: string };

export type CosmeticOption = {
  id: string;
  category: EquipmentCategory;
  name: string;
  sprite: ItemSpriteName;
  availability: CosmeticAvailability;
};

export const INITIAL_TITLE = 'Aprendiz';

const catalogOptions: readonly CosmeticOption[] = [
  { id: 'capuz-do-erudito', category: 'avatar', name: 'Capuz do Erudito', sprite: 'capuzDoErudito', availability: { kind: 'owned', caption: 'Traje do Erudito' } },
  { id: 'manto-da-vigilia', category: 'avatar', name: 'Manto da Vigília', sprite: 'mantoDaVigilia', availability: { kind: 'locked', caption: 'Recompensa da raid semanal' } },
  { id: 'madrugador-v', category: 'badge', name: 'Madrugador V', sprite: 'madrugadorV', availability: { kind: 'locked', caption: 'Estude 5 manhãs seguidas' } },
  { id: 'cem-sessoes', category: 'badge', name: 'Cem Sessões', sprite: 'cemSessoes', availability: { kind: 'locked', caption: 'Conclua 100 sessões de foco' } },
  { id: 'aprendiz', category: 'title', name: INITIAL_TITLE, sprite: 'estudanteCrepuscular', availability: { kind: 'owned', caption: 'Título inicial' } },
  { id: 'mestre-da-aurora', category: 'title', name: 'Mestre da Aurora', sprite: 'mestreDaAurora', availability: { kind: 'premium' } },
  { id: 'guardiao-da-aurora', category: 'title', name: 'Guardião da Aurora', sprite: 'mestreDaAurora', availability: { kind: 'locked', caption: 'Recompensa da raid semanal' } },
  { id: 'selo-dos-madrugadores', category: 'accessory', name: 'Selo dos Madrugadores', sprite: 'seloDosMadrugadores', availability: { kind: 'locked', caption: 'Recompensa da guilda' } },
  { id: 'cristal-da-aurora', category: 'accessory', name: 'Cristal da Aurora', sprite: 'cristalDaAurora', availability: { kind: 'premium' } },
];

export type EquippedItems = Record<EquipmentCategory, CosmeticOption | null>;

/** The profile title is the only equipped cosmetic the API reports; it may not exist in the local catalog. */
function titleOption(title: string | null): CosmeticOption {
  const name = title?.trim() || INITIAL_TITLE;
  return catalogOptions.find((option) => option.category === 'title' && option.name === name)
    ?? { id: `title:${name}`, category: 'title', name, sprite: 'estudanteCrepuscular', availability: { kind: 'owned', caption: 'Seu título atual' } };
}

export function equippedItems(profile: Pick<UserProfile, 'title'>, heroId: HeroId): EquippedItems {
  return {
    avatar: heroId === 'erudito' ? catalogOptions.find((option) => option.id === 'capuz-do-erudito') ?? null : null,
    badge: null,
    title: titleOption(profile.title),
    accessory: null,
  };
}

/** Owned options first (the equipped one leading), then premium, then locked — the drawer's reading order. */
export function optionsFor(category: EquipmentCategory, equipped: CosmeticOption | null): CosmeticOption[] {
  const options = catalogOptions.filter((option) => option.category === category && option.id !== equipped?.id);
  const rank = (option: CosmeticOption) => (option.availability.kind === 'owned' ? 0 : option.availability.kind === 'premium' ? 1 : 2);
  return [...(equipped ? [equipped] : []), ...options.sort((left, right) => rank(left) - rank(right))];
}
