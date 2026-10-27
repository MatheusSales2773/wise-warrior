import { paletteIndex } from '@/features/character/PixelSprite';
import type { PixelSpriteData } from '@/features/character/sprites';
import { defaultRaidSceneArt, raidSceneArt } from '@/features/guild/raid-scene-art';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH } from '@/features/guild/raid-scene-sprites';

/**
 * Read from the Figma 'Sprites (pixel art)' page, not from the code under test. `chefe` is the 'Chefe' component of the
 * scene; `bossPosition` is the top-left of 'Efeitos' + 'Chefe' together; `background` and `boss` are fingerprints of
 * the pixels the Figma holds (see `fingerprint`).
 */
const missions = [
  { slug: 'vigilia-da-aurora', chefe: { x: 124, y: 26, width: 47 }, bossPosition: { x: 100, y: 26 }, background: 283812, boss: 582322 },
  { slug: 'cerco-ao-grimorio', chefe: { x: 125, y: 18, width: 50 }, bossPosition: { x: 98, y: 18 }, background: 915623, boss: 45369 },
  { slug: 'marcha-do-silencio', chefe: { x: 125, y: 22, width: 50 }, bossPosition: { x: 100, y: 22 }, background: 326732, boss: 503301 },
  { slug: 'forja-dos-sabios', chefe: { x: 122, y: 28, width: 53 }, bossPosition: { x: 110, y: 20 }, background: 738043, boss: 217015 },
  { slug: 'contrato-do-grifo', chefe: { x: 120, y: 29, width: 58 }, bossPosition: { x: 96, y: 29 }, background: 822426, boss: 715712 },
  { slug: 'torre-dos-ratos', chefe: { x: 122, y: 33, width: 56 }, bossPosition: { x: 102, y: 33 }, background: 213980, boss: 967301 },
  { slug: 'ilha-das-brumas', chefe: { x: 120, y: 29, width: 56 }, bossPosition: { x: 98, y: 20 }, background: 697912, boss: 394624 },
  { slug: 'cacada-selvagem', chefe: { x: 120, y: 24, width: 58 }, bossPosition: { x: 96, y: 24 }, background: 504711, boss: 724076 },
] as const;

/** Folds every opaque pixel (its position and palette index) into one number, so any changed pixel changes it. */
function fingerprint({ rows }: PixelSpriteData): number {
  let hash = 0;
  rows.forEach((row, y) => {
    [...row].forEach((key, x) => {
      if (key !== '.') hash = (hash * 31 + paletteIndex(key) + 1 + (y * 131 + x)) % 1_000_003;
    });
  });
  return hash;
}

function expectRectangularInsidePalette(sprite: PixelSpriteData) {
  const width = sprite.rows[0]!.length;
  for (const row of sprite.rows) {
    expect(row).toHaveLength(width);
    for (const key of row.replace(/\./g, '')) expect(sprite.palette[paletteIndex(key)]).toMatch(/^#[0-9a-f]{6}$/);
  }
}

describe('raidSceneArt', () => {
  it('falls back to the Vulcão do Devorador for a Missão without its own art', () => {
    expect(raidSceneArt('missao-sem-arte')).toBe(defaultRaidSceneArt);
    expect(raidSceneArt('constructor')).toBe(defaultRaidSceneArt);
  });

  it('keeps the Vulcão do Devorador where the Figma 06b puts it', () => {
    expect(defaultRaidSceneArt.bossPosition).toEqual({ x: 103, y: 36 });
    expect(defaultRaidSceneArt.hitAnchor).toEqual({ x: 120, y: 32 });
  });

  it('gives each of the 8 Missões a scene of its own, apart from the Vulcão do Devorador', () => {
    const arts = missions.map(({ slug }) => raidSceneArt(slug));
    expect(arts).not.toContain(defaultRaidSceneArt);
    expect(new Set(arts.map((art) => art.background)).size).toBe(8);
    expect(new Set(arts.map((art) => art.boss)).size).toBe(8);
  });

  it.each(missions)('draws the $slug backdrop on the whole 180 × 80 scene, pixel for pixel as the Figma', ({ slug, background }) => {
    const art = raidSceneArt(slug).background;
    expect(art.rows).toHaveLength(RAID_SCENE_HEIGHT);
    expect(art.rows[0]).toHaveLength(RAID_SCENE_WIDTH);
    expectRectangularInsidePalette(art);
    expect(fingerprint(art)).toBe(background);
  });

  it.each(missions)('draws the $slug boss with its effects pixel for pixel as the Figma, at the Figma position', ({ slug, boss, bossPosition }) => {
    const art = raidSceneArt(slug);
    expectRectangularInsidePalette(art.boss);
    expect(fingerprint(art.boss)).toBe(boss);
    expect(art.bossPosition).toEqual(bossPosition);
    expect(art.bossPosition.x + art.boss.rows[0]!.length).toBeLessThanOrEqual(RAID_SCENE_WIDTH);
    expect(art.bossPosition.y + art.boss.rows.length).toBeLessThanOrEqual(RAID_SCENE_HEIGHT);
  });

  it.each(missions)('centers the $slug Golpe on the Chefe, 4 pixels above it', ({ slug, chefe }) => {
    const { hitAnchor } = raidSceneArt(slug);
    expect(hitAnchor.x).toBe(chefe.x + Math.floor(chefe.width / 2));
    expect(hitAnchor.y).toBe(Math.max(chefe.y - 4, 18));
  });

  it('keeps the Golpe of the Cerco ao Grimório (Chefe at y 18) out from under the "Vida do dragão" panel', () => {
    expect(raidSceneArt('cerco-ao-grimorio').hitAnchor.y).toBe(18);
  });
});
