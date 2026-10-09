import { render, screen } from '@testing-library/react-native';
import { cosmeticSprite, equippedItems, heroById, heroCaption, heroStatus, optionsFor } from '@/features/character/catalog';
import { formatCompactXp, formatDeviceSummary } from '@/features/character/formatters';
import type { CatalogCosmeticItem } from '@/features/profile/api';
import { cosmeticItemState, describeDevice, describeNextUnlock } from '@/features/profile/formatters';
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

  const item = (name: string, category: CatalogCosmeticItem['category'], unlockCondition: CatalogCosmeticItem['unlockCondition'], state: Partial<Pick<CatalogCosmeticItem, 'unlocked' | 'equipped' | 'requiresPremium'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category, name, unlockCondition, requiresPremium: false, unlocked: false, equipped: false, ...state,
  });
  const titles = [
    item('Guardião', 'title', { type: 'raid', slug: '*' }),
    item('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true, unlocked: true }),
    item('Aprendiz', 'title', { type: 'level', level: 1 }, { unlocked: true }),
    item('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { unlocked: true, equipped: true }),
    item('Sábio', 'title', { type: 'level', level: 30 }),
  ];

  it('orders the drawer as equipped, owned, premium and locked, with readable captions', () => {
    expect(optionsFor(titles, 'title', 'free').map((option) => [option.item.name, option.availability.kind, option.caption])).toEqual([
      ['Estudante Crepuscular', 'owned', 'Liberado no nível 5'],
      ['Aprendiz', 'owned', 'Título inicial'],
      ['Mestre da Aurora', 'premium', 'Plano premium'],
      ['Sábio', 'locked', 'Alcance o nível 30'],
      ['Guardião', 'locked', 'Conclua uma Raid com sua Guilda'],
    ]);
  });

  it('lets a premium plan own an unlocked premium item', () => {
    expect(optionsFor(titles, 'title', 'premium').find((option) => option.item.name === 'Mestre da Aurora')?.availability.kind).toBe('owned');
  });

  it('reads the equipped slots from the profile and picks the pixel art by item name', () => {
    const equipped = equippedItems({ equipped: [
      { category: 'title', itemId: 'item-Aprendiz', name: 'Aprendiz' },
      { category: 'accessory', itemId: 'item-novo', name: 'Item que ainda não tem arte' },
    ] });

    expect(equipped.title).toEqual({ itemId: 'item-Aprendiz', name: 'Aprendiz', sprite: 'estudanteCrepuscular' });
    expect(equipped.accessory?.sprite).toBe('cristalDaAurora');
    expect(equipped.avatar).toBeNull();
    expect(equipped.badge).toBeNull();
    expect(cosmeticSprite({ category: 'badge', name: 'Madrugador' })).toBe('madrugadorV');
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

describe('profile formatters', () => {
  const item = (name: string, unlockCondition: CatalogCosmeticItem['unlockCondition'], state: Partial<Pick<CatalogCosmeticItem, 'unlocked' | 'equipped'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category: 'badge', name, unlockCondition, requiresPremium: false, unlocked: false, equipped: false, ...state,
  });

  it('describes devices', () => {
    expect(describeDevice({ deviceLabel: ' Pixel ', userAgent: null })).toBe('Pixel');
    expect(describeDevice({ deviceLabel: null, userAgent: 'Dalvik Android 14' })).toBe('Dispositivo Android');
    expect(describeDevice({ deviceLabel: null, userAgent: null })).toBe('Dispositivo desconhecido');
  });

  it('reads one display state per Catalog item', () => {
    expect(cosmeticItemState(item('A', { type: 'level', level: 1 }, { unlocked: true, equipped: true }))).toBe('equipped');
    expect(cosmeticItemState(item('B', { type: 'level', level: 1 }, { unlocked: true }))).toBe('unlocked');
    expect(cosmeticItemState(item('C', { type: 'level', level: 5 }))).toBe('lockedByLevel');
    expect(cosmeticItemState(item('D', { type: 'raid', slug: '*' }))).toBe('lockedByRaid');
  });

  it('does not send the student to Raids when a level item is already within reach but not yet granted', () => {
    const items = [item('Madrugador', { type: 'level', level: 3 }), item('Selo', { type: 'raid', slug: '*' })];

    expect(describeNextUnlock(items, 4)).toBe('Madrugador já está liberado para o seu nível.');
    expect(describeNextUnlock(items, 1)).toBe('Faltam 2 níveis para desbloquear Madrugador.');
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
