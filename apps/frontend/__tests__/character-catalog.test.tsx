import { render, screen } from '@testing-library/react-native';
import { cosmeticSprite, equipmentCategoryById, equippedItems, optionsFor } from '@/features/character/catalog';
import { formatCompactXp, formatDeviceSummary } from '@/features/character/formatters';
import type { CatalogCosmeticItem } from '@/features/profile/api';
import { cosmeticItemState, describeDevice, describeNextUnlock } from '@/features/profile/formatters';
import { avatarLayerFor } from '@/features/character/layered-hero';
import { PixelSprite } from '@/features/character/PixelSprite';
import { accessoryLayers, avatarLayers, heroBody, heroSprites, itemSprites, companionSprites, initialAvatarLayer, type PixelSpriteData } from '@/features/character/sprites';

describe('character catalog', () => {
  const item = (name: string, category: CatalogCosmeticItem['category'], unlockCondition: CatalogCosmeticItem['unlockCondition'], state: Partial<Pick<CatalogCosmeticItem, 'unlocked' | 'equipped' | 'requiresPremium' | 'forSale'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category, name, unlockCondition, requiresPremium: false, unlocked: false, equipped: false, forSale: false, ...state,
  });
  const titles = [
    item('Guardião', 'title', { type: 'raid', slug: '*' }),
    item('Mestre da Aurora', 'title', { type: 'level', level: 15 }, { requiresPremium: true, unlocked: true }),
    item('Aprendiz', 'title', { type: 'level', level: 1 }, { unlocked: true }),
    item('Estudante Crepuscular', 'title', { type: 'level', level: 5 }, { unlocked: true, equipped: true }),
    item('Sábio', 'title', { type: 'level', level: 30 }),
  ];

  it('knows the Arma category, so a Loja item or an equipped Arma never reaches an undefined definition', () => {
    expect(equipmentCategoryById.weapon.label).toBe('Arma');
    expect(equippedItems({ equipped: [{ category: 'weapon', itemId: 'sword', name: 'Espada' }] }).weapon)
      .toMatchObject({ itemId: 'sword', name: 'Espada' });
    expect(equippedItems({ equipped: [] }).weapon).toBeNull();
  });

  it('orders the drawer as equipped, owned, premium and locked, with readable captions', () => {
    expect(optionsFor(titles, 'title', 'free').map((option) => [option.item.name, option.availability.kind, option.caption])).toEqual([
      ['Estudante Crepuscular', 'owned', 'Liberado no nível 5'],
      ['Aprendiz', 'owned', 'Título inicial'],
      ['Mestre da Aurora', 'premium', 'Plano premium'],
      ['Sábio', 'locked', 'Alcance o nível 30'],
      ['Guardião', 'locked', 'Conclua uma Raid com sua Guilda'],
    ]);
  });

  it('captions the three Purchase states without falling into the Raid case', () => {
    const shop = [
      item('Brasão', 'badge', { type: 'purchase' }, { unlocked: true }),
      item('Lanterna', 'badge', { type: 'purchase' }, { forSale: true }),
      item('Marcador', 'badge', { type: 'purchase' }),
      item('Selo', 'badge', { type: 'raid', slug: '*' }),
    ];

    expect(optionsFor(shop, 'badge', 'free').map((option) => [option.item.name, option.availability.kind, option.caption])).toEqual([
      ['Brasão', 'owned', 'Comprado na Loja'],
      ['Lanterna', 'locked', 'À venda na Loja'],
      ['Selo', 'locked', 'Conclua uma Raid com sua Guilda'],
      ['Marcador', 'locked', 'Fora de venda'],
    ]);
  });

  it('keeps a Purchase item owned and captioned the same once it leaves the shelf', () => {
    const [owned] = optionsFor([item('Brasão', 'badge', { type: 'purchase' }, { unlocked: true, forSale: false })], 'badge', 'free');

    expect(owned?.caption).toBe('Comprado na Loja');
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
  const item = (name: string, unlockCondition: CatalogCosmeticItem['unlockCondition'], state: Partial<Pick<CatalogCosmeticItem, 'unlocked' | 'equipped' | 'forSale'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category: 'badge', name, unlockCondition, requiresPremium: false, unlocked: false, equipped: false, forSale: false, ...state,
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
    expect(cosmeticItemState(item('E', { type: 'purchase' }, { forSale: true }))).toBe('lockedByPurchase');
    expect(cosmeticItemState(item('F', { type: 'purchase' }))).toBe('offSale');
    expect(cosmeticItemState(item('G', { type: 'purchase' }, { unlocked: true }))).toBe('unlocked');
  });

  it('names where the remaining locked items come from', () => {
    const forSale = item('Lanterna', { type: 'purchase' }, { forSale: true });
    const offSale = item('Marcador', { type: 'purchase' });
    const raid = item('Selo', { type: 'raid', slug: '*' });

    expect(describeNextUnlock([forSale], 1)).toBe('Os itens desta categoria são comprados na Loja.');
    expect(describeNextUnlock([offSale], 1)).toBe('Os itens desta categoria estão fora de venda.');
    expect(describeNextUnlock([raid], 1)).toBe('Os itens desta categoria são conquistados em Raids com sua Guilda.');
    expect(describeNextUnlock([raid, forSale], 1)).toBe('Os itens desta categoria são conquistados em Raids com sua Guilda ou comprados na Loja.');
    expect(describeNextUnlock([forSale, offSale], 1)).toBe('Os itens desta categoria são comprados na Loja.');
  });

  it('does not send the student to Raids when a level item is already within reach but not yet granted', () => {
    const items = [item('Madrugador', { type: 'level', level: 3 }), item('Selo', { type: 'raid', slug: '*' })];

    expect(describeNextUnlock(items, 4)).toBe('Madrugador já está liberado para o seu nível.');
    expect(describeNextUnlock(items, 1)).toBe('Faltam 2 níveis para desbloquear Madrugador.');
  });
});

describe('pixel sprites', () => {
  const all = { ...heroSprites, ...itemSprites, ...companionSprites, heroBody, ...avatarLayers, ...accessoryLayers } as Record<string, PixelSpriteData>;

  it.each(Object.entries(all))('%s has a rectangular grid whose keys exist in its palette', (_, sprite) => {
    const width = sprite.rows[0]?.length;
    for (const row of sprite.rows) {
      expect(row).toHaveLength(width ?? 0);
      for (const key of row.replaceAll('.', '')) expect(sprite.palette[key.charCodeAt(0) - 97]).toBeDefined();
    }
  });

  it('keeps hero sprites, the body and every layer at the Figma 16×24 grid', () => {
    for (const sprite of [...Object.values(heroSprites), heroBody, ...Object.values(avatarLayers), ...Object.values(accessoryLayers)]) {
      expect(sprite.rows).toHaveLength(24);
      expect(sprite.rows[0]).toHaveLength(16);
    }
  });

  it('falls back to the initial Avatar layer without an Avatar or without art for it', () => {
    expect(avatarLayerFor({ avatar: null })).toBe(initialAvatarLayer);
    expect(avatarLayerFor({ avatar: { name: 'Armadura do Lobo' } })).toBe(initialAvatarLayer);
    expect(avatarLayerFor({ avatar: { name: 'Manto Estelar' } })).toBe(avatarLayers['Manto Estelar']);
  });

  it('composes the initial Avatar over the body into the initial class sprite', () => {
    const paint = (sprite: PixelSpriteData, y: number, x: number) => {
      const key = sprite.rows[y]?.charAt(x);
      return key && key !== '.' ? sprite.palette[key.charCodeAt(0) - 97] : undefined;
    };
    for (let y = 0; y < 24; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        expect(paint(initialAvatarLayer, y, x) ?? paint(heroBody, y, x)).toBe(paint(heroSprites.erudito, y, x));
      }
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
