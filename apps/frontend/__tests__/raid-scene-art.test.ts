import { defaultRaidSceneArt, raidSceneArt, type RaidSceneArt } from '@/features/guild/raid-scene-art';
import { RAID_SCENE_HEIGHT, RAID_SCENE_WIDTH } from '@/features/guild/raid-scene-sprites';

/** Figma "Sprites (pixel art)": the Chefe component's position and size in each `Cena/Raid — …`. */
const missions = [
  { slug: 'vigilia-da-aurora', chefe: { x: 124, y: 26, width: 47, height: 47 } },
  { slug: 'cerco-ao-grimorio', chefe: { x: 125, y: 18, width: 50, height: 46 } },
  { slug: 'marcha-do-silencio', chefe: { x: 125, y: 22, width: 50, height: 50 } },
  { slug: 'forja-dos-sabios', chefe: { x: 122, y: 28, width: 53, height: 50 } },
  { slug: 'contrato-do-grifo', chefe: { x: 120, y: 29, width: 58, height: 47 } },
  { slug: 'torre-dos-ratos', chefe: { x: 122, y: 33, width: 56, height: 44 } },
  { slug: 'ilha-das-brumas', chefe: { x: 120, y: 29, width: 56, height: 49 } },
  { slug: 'cacada-selvagem', chefe: { x: 120, y: 24, width: 58, height: 56 } },
] as const;

function paletteIndex(key: string) {
  return key >= 'a' ? key.charCodeAt(0) - 97 : key.charCodeAt(0) - 65 + 26;
}

function expectRectangularInsidePalette(sprite: RaidSceneArt['background']) {
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

  it.each(missions)('gives $slug a scene of its own, apart from the Vulcão do Devorador', ({ slug }) => {
    const art = raidSceneArt(slug);
    expect(art).not.toBe(defaultRaidSceneArt);
    expect(art.background).not.toBe(defaultRaidSceneArt.background);
    expect(art.boss).not.toBe(defaultRaidSceneArt.boss);
  });

  it('gives each of the 8 Missões a different scene', () => {
    const backgrounds = new Set(missions.map(({ slug }) => raidSceneArt(slug).background));
    const bosses = new Set(missions.map(({ slug }) => raidSceneArt(slug).boss));
    expect(backgrounds.size).toBe(8);
    expect(bosses.size).toBe(8);
  });

  it.each(missions)('draws the $slug backdrop on the whole 180 × 80 scene, inside its palette', ({ slug }) => {
    const { background } = raidSceneArt(slug);
    expect(background.rows).toHaveLength(RAID_SCENE_HEIGHT);
    expect(background.rows[0]).toHaveLength(RAID_SCENE_WIDTH);
    expectRectangularInsidePalette(background);
  });

  it.each(missions)('places the $slug boss and its effects inside the scene, over the Chefe', ({ slug, chefe }) => {
    const { boss, bossPosition } = raidSceneArt(slug);
    expectRectangularInsidePalette(boss);
    const width = boss.rows[0]!.length;
    expect(bossPosition.x).toBeGreaterThanOrEqual(0);
    expect(bossPosition.y).toBeGreaterThanOrEqual(0);
    expect(bossPosition.x + width).toBeLessThanOrEqual(RAID_SCENE_WIDTH);
    expect(bossPosition.y + boss.rows.length).toBeLessThanOrEqual(RAID_SCENE_HEIGHT);
    // The sprite starts at or before the Chefe: it also holds the effects drawn around it.
    expect(bossPosition.x).toBeLessThanOrEqual(chefe.x);
    expect(bossPosition.y).toBeLessThanOrEqual(chefe.y);
    expect(bossPosition.x + width).toBeGreaterThanOrEqual(chefe.x + chefe.width);
  });

  it.each(missions)('anchors the $slug Golpe over the boss', ({ slug, chefe }) => {
    const { hitAnchor } = raidSceneArt(slug);
    expect(hitAnchor.x).toBeGreaterThanOrEqual(chefe.x);
    expect(hitAnchor.x).toBeLessThanOrEqual(chefe.x + chefe.width);
    expect(hitAnchor.y).toBeGreaterThanOrEqual(0);
    expect(hitAnchor.y).toBeLessThanOrEqual(chefe.y);
  });
});
