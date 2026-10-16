import type { PixelSpriteData } from '@/features/character/sprites';
import { raidSceneBackground, raidSceneBoss } from './raid-scene-sprites';

/** The illustration of a Missão: the backdrop and the boss drawn in it. */
export type RaidSceneArt = { background: PixelSpriteData; boss: PixelSpriteData };

/** "Vulcão do Devorador", the scene of the Figma 06b. Also what a Missão without its own art gets. */
export const defaultRaidSceneArt: RaidSceneArt = { background: raidSceneBackground, boss: raidSceneBoss };

/** The Missão `slug` is the art key (the API needs no new field). Register a Missão's own scene here. */
const raidSceneArtBySlug: Readonly<Record<string, RaidSceneArt>> = {};

export function raidSceneArt(slug: string): RaidSceneArt {
  return Object.hasOwn(raidSceneArtBySlug, slug) ? raidSceneArtBySlug[slug]! : defaultRaidSceneArt;
}
