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

type ScenePoint = { x: number; y: number };

/**
 * The illustration of a Missão: the backdrop, the boss (with its effects) and where each sits in the 180 × 80 scene.
 * `bossPosition` is the top-left pixel of the `boss` sprite; `hitAnchor` is the center of the top of the latest Golpe.
 */
export type RaidSceneArt = {
  background: PixelSpriteData;
  boss: PixelSpriteData;
  bossPosition: ScenePoint;
  hitAnchor: ScenePoint;
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

/*
 * The other scenes come from the Figma components 'Cena/Raid — <Missão>'. Each boss sprite holds the 'Efeitos' and the
 * 'Chefe' of its scene, so `bossPosition` is the top-left of that union. The Figma has no Golpe marker, so each
 * `hitAnchor` is the horizontal center of the 'Chefe' component, 4 pixels above its top.
 */
/** The Missão `slug` is the art key (the API needs no new field). Register a Missão's own scene here. */
const raidSceneArtBySlug: Readonly<Record<string, RaidSceneArt>> = {
  'vigilia-da-aurora': { background: vigiliaDaAuroraBackground, boss: vigiliaDaAuroraBoss, bossPosition: { x: 100, y: 26 }, hitAnchor: { x: 148, y: 22 } },
  'cerco-ao-grimorio': { background: cercoAoGrimorioBackground, boss: cercoAoGrimorioBoss, bossPosition: { x: 98, y: 18 }, hitAnchor: { x: 150, y: 14 } },
  'marcha-do-silencio': { background: marchaDoSilencioBackground, boss: marchaDoSilencioBoss, bossPosition: { x: 100, y: 22 }, hitAnchor: { x: 150, y: 18 } },
  'forja-dos-sabios': { background: forjaDosSabiosBackground, boss: forjaDosSabiosBoss, bossPosition: { x: 110, y: 20 }, hitAnchor: { x: 148, y: 24 } },
  'contrato-do-grifo': { background: contratoDoGrifoBackground, boss: contratoDoGrifoBoss, bossPosition: { x: 96, y: 29 }, hitAnchor: { x: 149, y: 25 } },
  'torre-dos-ratos': { background: torreDosRatosBackground, boss: torreDosRatosBoss, bossPosition: { x: 102, y: 33 }, hitAnchor: { x: 150, y: 29 } },
  'ilha-das-brumas': { background: ilhaDasBrumasBackground, boss: ilhaDasBrumasBoss, bossPosition: { x: 98, y: 20 }, hitAnchor: { x: 148, y: 25 } },
  'cacada-selvagem': { background: cacadaSelvagemBackground, boss: cacadaSelvagemBoss, bossPosition: { x: 96, y: 24 }, hitAnchor: { x: 149, y: 20 } },
};

export function raidSceneArt(slug: string): RaidSceneArt {
  return Object.hasOwn(raidSceneArtBySlug, slug) ? raidSceneArtBySlug[slug]! : defaultRaidSceneArt;
}
