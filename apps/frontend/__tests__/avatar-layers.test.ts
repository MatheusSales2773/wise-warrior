import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FACE_ROWS, GRID_HEIGHT, GRID_WIDTH, HAND_ROWS, SKIN_KEYS, avatarLayers, heroBody } from '@/features/character/sprites';

/** The Avatars seeded in the Catalog by the backend migrations: each one needs a layer of its own (#261). */
const MIGRATIONS = join(__dirname, '../../backend/src/migrations');
const CATALOG_AVATARS = [
  ...new Set(
    readdirSync(MIGRATIONS)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .flatMap((file) => [...readFileSync(join(MIGRATIONS, file), 'utf8').matchAll(/'avatar',\s*'([^']+)'/g)].map((match) => match[1]!)),
  ),
];

const isSkin = (pixel: string) => SKIN_KEYS.includes(pixel);

const bodyPixels = heroBody.rows.flatMap((row, y) => [...row].map((pixel, x) => ({ pixel, x, y })));

describe('avatarLayers', () => {
  it('finds the seeded Avatars of the Catalog', () => {
    expect(CATALOG_AVATARS).toEqual(expect.arrayContaining(['Capuz do Erudito', 'Manto Estelar', 'Armadura do Lobo']));
  });

  it('has a layer for every Avatar of the Catalog', () => {
    for (const name of CATALOG_AVATARS) expect(avatarLayers[name]).toBeDefined();
  });

  it('gives each Avatar its own art', () => {
    const drawn = CATALOG_AVATARS.map((name) => JSON.stringify(avatarLayers[name]!.rows));
    expect(new Set(drawn).size).toBe(CATALOG_AVATARS.length);
  });

  describe.each(CATALOG_AVATARS)('%s', (name) => {
    const layer = avatarLayers[name]!;
    const paints = (x: number, y: number) => (layer.rows[y]?.[x] ?? '.') !== '.';

    it('fits the 16 × 24 grid of the body', () => {
      expect(layer.rows).toHaveLength(GRID_HEIGHT);
      for (const row of layer.rows) expect(row).toHaveLength(GRID_WIDTH);
    });

    it('leaves no gap: it covers every cloth and outline pixel of the body', () => {
      const gaps = bodyPixels.filter(({ pixel, x, y }) => pixel !== '.' && !isSkin(pixel) && !paints(x, y));
      expect(gaps).toEqual([]);
    });

    it('leaves no overflow onto the face and hands of the body', () => {
      const covered = bodyPixels.filter(({ pixel, x, y }) => isSkin(pixel) && (FACE_ROWS.includes(y) || HAND_ROWS.includes(y)) && paints(x, y));
      expect(covered).toEqual([]);
    });

    it('leaves no stray pixels: everything it paints is one connected piece', () => {
      const painted = new Set<string>();
      layer.rows.forEach((row, y) => [...row].forEach((pixel, x) => pixel !== '.' && painted.add(`${x},${y}`)));
      const [start] = painted;
      const seen = new Set([start!]);
      const queue = [start!];
      while (queue.length > 0) {
        const [x, y] = queue.pop()!.split(',').map(Number) as [number, number];
        for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
          const key = `${x + dx},${y + dy}`;
          if (painted.has(key) && !seen.has(key)) { seen.add(key); queue.push(key); }
        }
      }
      expect(seen.size).toBe(painted.size);
    });
  });
});
