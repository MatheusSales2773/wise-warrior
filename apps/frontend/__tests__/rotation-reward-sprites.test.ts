import { cosmeticSprite } from '@/features/character/catalog';

const ROTATION_REWARDS = [
  ['badge', 'Marcador do Grimório', 'marcadorDoGrimorio'],
  ['accessory', 'Lanterna do Silêncio', 'lanternaDoSilencio'],
  ['badge', 'Brasão da Forja', 'brasaoDaForja'],
] as const;

describe('sprites of the Raid rotation reward items (#179)', () => {
  it.each(ROTATION_REWARDS)('draws %s %s with its own sprite', (category, name, sprite) => {
    expect(cosmeticSprite({ category, name })).toBe(sprite);
  });
});
