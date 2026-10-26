import { cosmeticSprite } from '@/features/character/catalog';
import { itemSprites } from '@/features/character/sprites';
import type { Milestone } from './api';

/** The pixel art of a Marco's Badge, as Crônicas and the Acampamento draw it. */
export const spriteOf = (milestone: Milestone) => itemSprites[cosmeticSprite({ category: 'badge', name: milestone.name })];
