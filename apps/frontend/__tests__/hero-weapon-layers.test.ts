import { GRID_HEIGHT, GRID_WIDTH, heroBody, weaponLayers } from '@/features/character/sprites';

/** The hand of the body: the skin pixels (`e`) of the rows where the right arm hangs. */
const handPixels = heroBody.rows
  .flatMap((row, y) => [...row].map((pixel, x) => ({ pixel, x, y })))
  .filter(({ pixel, x, y }) => pixel === 'e' && x > GRID_WIDTH / 2 && y > 12);

describe('weaponLayers', () => {
  it.each(Object.entries(weaponLayers))('%s fills the 16 × 24 grid of the body', (_name, layer) => {
    expect(layer.rows).toHaveLength(GRID_HEIGHT);
    for (const row of layer.rows) expect(row).toHaveLength(GRID_WIDTH);
  });

  it.each(Object.entries(weaponLayers))('%s is gripped in the right hand of the body', (_name, layer) => {
    expect(handPixels.length).toBeGreaterThan(0);
    for (const { x, y } of handPixels) expect(layer.rows[y]![x]).not.toBe('.');
  });
});
