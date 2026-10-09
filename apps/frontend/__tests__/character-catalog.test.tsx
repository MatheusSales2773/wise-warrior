import { render, screen } from '@testing-library/react-native';
import { equippedItems, heroById, heroCaption, heroStatus, optionsFor } from '@/features/character/catalog';
import { formatCompactXp, formatDeviceSummary } from '@/features/character/formatters';
import { PixelSprite } from '@/features/character/PixelSprite';
import { heroSprites, itemSprites, companionSprites, type PixelSpriteData } from '@/features/character/sprites';

describe('character catalog', () => {
  it.each([
    [{ level: 1, planTier: 'free' }, 'guerreira', 'level-locked'],
    [{ level: 10, planTier: 'free' }, 'guerreira', 'unlocked'],
    [{ level: 30, planTier: 'free' }, 'paladino', 'premium-locked'],
    [{ level: 1, planTier: 'premium' }, 'paladino', 'unlocked'],
    [{ level: 1, planTier: 'free' }, 'erudito', 'equipped'],
  ] as const)('resolves %o for %s as %s', (progress, heroId, status) => {
    expect(heroStatus(heroById[heroId], progress, 'erudito')).toBe(status);
  });

  it('words level captions by whether the hero is already unlocked', () => {
    expect(heroCaption(heroById.arcanista, 'level-locked')).toBe('Libera no nível 20');
    expect(heroCaption(heroById.arcanista, 'unlocked')).toBe('Liberada no nível 20');
  });

  it('treats an unknown profile title as an owned item and leads the drawer with it', () => {
    const equipped = equippedItems({ title: 'Estudante Crepuscular' }, 'erudito');
    const titles = optionsFor('title', equipped.title).map((option) => [option.name, option.availability.kind]);

    expect(titles).toEqual([
      ['Estudante Crepuscular', 'owned'],
      ['Aprendiz', 'owned'],
      ['Mestre da Aurora', 'premium'],
      ['Guardião da Aurora', 'locked'],
    ]);
  });

  it('does not duplicate the initial title when it is the equipped one', () => {
    const equipped = equippedItems({ title: null }, 'erudito');
    expect(optionsFor('title', equipped.title).filter((option) => option.name === 'Aprendiz')).toHaveLength(1);
    expect(equipped.badge).toBeNull();
    expect(equipped.accessory).toBeNull();
  });
});

describe('character formatters', () => {
  it.each([[0, '0'], [950, '950'], [1_950, '1,9k'], [128_400, '128,4k'], [128_499, '128,4k'], [1_250_000, '1,2M']])('compacts %s XP as %s', (value, expected) => {
    expect(formatCompactXp(value)).toBe(expected);
  });

  it.each([[1, 'Somente este navegador'], [2, 'Este navegador e mais 1 sessão'], [3, 'Este navegador e mais 2 sessões']])('summarizes %s device sessions', (count, expected) => {
    expect(formatDeviceSummary(count, 'Este navegador')).toBe(expected);
  });

  it.each([[1, 'Somente este navegador'], [2, 'Este navegador e mais 1'], [3, 'Este navegador e mais 2']])('drops the noun in the compact (mobile) wording for %s sessions', (count, expected) => {
    expect(formatDeviceSummary(count, 'Este navegador', true)).toBe(expected);
  });
});

describe('pixel sprites', () => {
  const all = { ...heroSprites, ...itemSprites, ...companionSprites } as Record<string, PixelSpriteData>;

  it.each(Object.entries(all))('%s has a rectangular grid whose keys exist in its palette', (_, sprite) => {
    const width = sprite.rows[0]?.length;
    for (const row of sprite.rows) {
      expect(row).toHaveLength(width ?? 0);
      for (const key of row.replaceAll('.', '')) expect(sprite.palette[key.charCodeAt(0) - 97]).toBeDefined();
    }
  });

  it('keeps hero sprites at the Figma 16×24 grid', () => {
    for (const sprite of Object.values(heroSprites)) {
      expect(sprite.rows).toHaveLength(24);
      expect(sprite.rows[0]).toHaveLength(16);
    }
  });

  it('renders at an integer scale and merges same-colour runs', async () => {
    await render(<PixelSprite scale={6} sprite={itemSprites.estudanteCrepuscular} testID="sprite" />);
    const svg = screen.getByTestId('sprite', { includeHiddenElements: true });
    expect(svg.props.width).toBe(48);
    expect(svg.props.height).toBe(48);
  });

  it('rejects fractional scales that would blur pixels', async () => {
    await expect(render(<PixelSprite scale={2.5} sprite={itemSprites.estudanteCrepuscular} />)).rejects.toThrow(/integer/);
  });
});
