import type { PixelSpriteData } from '@/features/character/sprites';
import { cacadaSelvagemBackground, cacadaSelvagemBoss } from './raid-scenes/cacada-selvagem';
import { cercoAoGrimorioBackground, cercoAoGrimorioBoss } from './raid-scenes/cerco-ao-grimorio';
import { contratoDoGrifoBackground, contratoDoGrifoBoss } from './raid-scenes/contrato-do-grifo';
import { forjaDosSabiosBackground, forjaDosSabiosBoss } from './raid-scenes/forja-dos-sabios';
import { ilhaDasBrumasBackground, ilhaDasBrumasBoss } from './raid-scenes/ilha-das-brumas';
import { marchaDoSilencioBackground, marchaDoSilencioBoss } from './raid-scenes/marcha-do-silencio';
import { torreDosRatosBackground, torreDosRatosBoss } from './raid-scenes/torre-dos-ratos';
import { vigiliaDaAuroraBackground, vigiliaDaAuroraBoss } from './raid-scenes/vigilia-da-aurora';
import { raidSceneBackground, raidSceneBoss } from './raid-scene-sprites';

export type RaidScenePoint = { x: number; y: number };

/**
 * The illustration of a Missão: the backdrop, the boss (with its effects) and where each sits in the 180 × 80 scene.
 * `bossPosition` is the top-left pixel of the `boss` sprite; `hitAnchor` is the center of the top of the latest Golpe.
 */
export type RaidSceneArt = {
  background: PixelSpriteData;
  boss: PixelSpriteData;
  bossPosition: RaidScenePoint;
  hitAnchor: RaidScenePoint;
};

/**
 * "Vulcão do Devorador", the scene of the Figma 06b. Also what a Missão without its own art gets. The dragon is at
 * (103, 36); the Golpe sits at (120, 32), in front of its head (Figma 06b: "−75" at 690,192 in the ×6 scene).
 */
export const defaultRaidSceneArt: RaidSceneArt = {
  background: raidSceneBackground,
  boss: raidSceneBoss,
  bossPosition: { x: 103, y: 36 },
  hitAnchor: { x: 120, y: 32 },
};

/** Pixels between the top of the 'Chefe' and the Golpe above it (the Vulcão keeps its 4 too: dragon at y 36, Golpe at 32). */
const HIT_ABOVE_CHEFE = 4;

/** The 'Chefe' component of a scene: where it sits and how wide it is. The Figma gives no Golpe marker, so the Golpe is derived from it. */
type Chefe = { x: number; y: number; width: number };

/**
 * A scene from the Figma components 'Cena/Raid — <Missão>'. The boss sprite holds the 'Efeitos' and the 'Chefe', so
 * `bossPosition` is the top-left of that union, not of the 'Chefe'. The Golpe is centered on the 'Chefe', above its top.
 */
function sceneArt(background: PixelSpriteData, boss: PixelSpriteData, bossPosition: RaidScenePoint, chefe: Chefe): RaidSceneArt {
  return { background, boss, bossPosition, hitAnchor: { x: chefe.x + Math.floor(chefe.width / 2), y: chefe.y - HIT_ABOVE_CHEFE } };
}

/** The Missão `slug` is the art key (the API needs no new field). Register a Missão's own scene here. */
const raidSceneArtBySlug: Readonly<Record<string, RaidSceneArt>> = {
  'vigilia-da-aurora': sceneArt(vigiliaDaAuroraBackground, vigiliaDaAuroraBoss, { x: 100, y: 26 }, { x: 124, y: 26, width: 47 }),
  'cerco-ao-grimorio': sceneArt(cercoAoGrimorioBackground, cercoAoGrimorioBoss, { x: 98, y: 18 }, { x: 125, y: 18, width: 50 }),
  'marcha-do-silencio': sceneArt(marchaDoSilencioBackground, marchaDoSilencioBoss, { x: 100, y: 22 }, { x: 125, y: 22, width: 50 }),
  'forja-dos-sabios': sceneArt(forjaDosSabiosBackground, forjaDosSabiosBoss, { x: 110, y: 20 }, { x: 122, y: 28, width: 53 }),
  'contrato-do-grifo': sceneArt(contratoDoGrifoBackground, contratoDoGrifoBoss, { x: 96, y: 29 }, { x: 120, y: 29, width: 58 }),
  'torre-dos-ratos': sceneArt(torreDosRatosBackground, torreDosRatosBoss, { x: 102, y: 33 }, { x: 122, y: 33, width: 56 }),
  'ilha-das-brumas': sceneArt(ilhaDasBrumasBackground, ilhaDasBrumasBoss, { x: 98, y: 20 }, { x: 120, y: 29, width: 56 }),
  'cacada-selvagem': sceneArt(cacadaSelvagemBackground, cacadaSelvagemBoss, { x: 96, y: 24 }, { x: 120, y: 24, width: 58 }),
};

export function raidSceneArt(slug: string): RaidSceneArt {
  return Object.hasOwn(raidSceneArtBySlug, slug) ? raidSceneArtBySlug[slug]! : defaultRaidSceneArt;
}
