import { cosmeticSprite } from '@/features/character/catalog';
import { itemSprites } from '@/features/character/sprites';

const ITEMS_FOR_SALE = [
  ['accessory', 'Marcador de Fita', 'marcadorDeFita'],
  ['title', 'Guardião das Páginas', 'guardiaoDasPaginas'],
  ['accessory', 'Pena do Escriba', 'penaDoEscriba'],
  ['title', 'Andarilho do Saber', 'andarilhoDoSaber'],
  ['avatar', 'Túnica do Viajante', 'tunicaDoViajante'],
  ['accessory', 'Lanterna do Vigia', 'lanternaDoVigia'],
  ['title', 'Arquimago dos Prazos', 'arquimagoDosPrazos'],
  ['avatar', 'Manto Estelar', 'mantoEstelar'],
] as const;

describe('sprites of the Cosmetic Items À venda (#174)', () => {
  it.each(ITEMS_FOR_SALE)('draws %s %s with its own sprite', (category, name, sprite) => {
    expect(cosmeticSprite({ category, name })).toBe(sprite);
  });

  it.each(ITEMS_FOR_SALE)('keeps %s %s on an 8x8 grid that its palette covers', (_category, _name, sprite) => {
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
