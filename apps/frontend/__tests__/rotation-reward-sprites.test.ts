import { cosmeticSprite } from '@/features/character/catalog';
import { itemSprites } from '@/features/character/sprites';

const ROTATION_REWARDS = [
  ['badge', 'Marcador do Grimório', 'marcadorDoGrimorio'],
  ['accessory', 'Lanterna do Silêncio', 'lanternaDoSilencio'],
  ['badge', 'Brasão da Forja', 'brasaoDaForja'],
] as const;

describe('sprites of the Raid rotation reward items (#179)', () => {
  it.each(ROTATION_REWARDS)('draws %s %s with its own sprite', (category, name, sprite) => {
    expect(cosmeticSprite({ category, name })).toBe(sprite);
  });

  it.each(ROTATION_REWARDS)('keeps %s %s on an 8x8 grid that its palette covers', (_category, _name, sprite) => {
    const { palette, rows } = itemSprites[sprite];
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row).toHaveLength(8);
      for (const cell of row) {
        if (cell !== '.') expect(cell.charCodeAt(0) - 'a'.charCodeAt(0)).toBeLessThan(palette.length);
      }
    }
  });
});
