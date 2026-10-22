import { GRID_HEIGHT, GRID_WIDTH, avatarLayers, heroBody } from '@/features/character/sprites';

/** The Avatars seeded in the Catalog (backend migrations); each one needs a layer of its own (#261). */
const CATALOG_AVATARS = ['Capuz do Erudito', 'Manto da Vigília', 'Túnica do Viajante', 'Manto Estelar', 'Armadura do Lobo'];

const FACE_ROWS = [5, 6, 7, 8];
const HAND_ROWS = [13, 14];
const isSkin = (pixel: string) => 'efg'.includes(pixel);

const bodyPixels = heroBody.rows.flatMap((row, y) => [...row].map((pixel, x) => ({ pixel, x, y })));

describe('avatarLayers', () => {
  it('has a layer for every Avatar of the Catalog', () => {
    for (const name of CATALOG_AVATARS) expect(avatarLayers[name]).toBeDefined();
  });

  it('gives each Avatar its own art', () => {
    const drawn = CATALOG_AVATARS.map((name) => JSON.stringify(avatarLayers[name]));
    expect(new Set(drawn).size).toBe(CATALOG_AVATARS.length);
  });

  describe.each(CATALOG_AVATARS)('%s', (name) => {
    const layer = avatarLayers[name]!;
    const paints = (x: number, y: number) => layer?.rows[y]?.[x] !== undefined && layer.rows[y]![x] !== '.';

    it('fits the 16 × 24 grid of the body', () => {
      expect(layer.rows).toHaveLength(GRID_HEIGHT);
      for (const row of layer.rows) expect(row).toHaveLength(GRID_WIDTH);
    });

    it('leaves no gap: it covers every cloth and outline pixel of the body', () => {
      const gaps = bodyPixels.filter(({ pixel, x, y }) => pixel !== '.' && !isSkin(pixel) && !paints(x, y));
      expect(gaps).toEqual([]);
    });

    it('leaves no overflow: the face and hands of the body stay uncovered', () => {
      const covered = bodyPixels.filter(({ pixel, x, y }) => isSkin(pixel) && (FACE_ROWS.includes(y) || HAND_ROWS.includes(y)) && paints(x, y));
      expect(covered).toEqual([]);
    });
  });
});
