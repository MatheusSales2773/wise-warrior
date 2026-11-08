import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { cosmeticSprite, equipmentCategoryById, equippedItems, optionsFor } from '@/features/character/catalog';
import { formatCompactXp } from '@/features/character/formatters';
import type { CatalogCosmeticItem } from '@/features/profile/api';
import { cosmeticItemState, describeDevice, describeNextUnlock, describeUnlockCondition } from '@/features/profile/formatters';
import { LayeredHero, avatarLayerFor, type HeroLayers } from '@/features/character/layered-hero';
import { PixelSprite } from '@/features/character/PixelSprite';
import { accessoryLayers, avatarLayers, heroBody, heroSprites, itemSprites, companionSprites, initialAvatarLayer, weaponLayers, type PixelSpriteData } from '@/features/character/sprites';

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

  it('shows the session-count unlock conditions, ahead of Raid and Loja items', () => {
    const badges = [
      item('Selo', 'badge', { type: 'raid', slug: '*' }),
      item('Cem Sessões', 'badge', { type: 'sessions', count: 100 }),
      item('Madrugador', 'badge', { type: 'early-sessions', count: 5 }, { unlocked: true }),
    ];

    expect(optionsFor(badges, 'badge', 'free').map((option) => [option.item.name, option.availability.kind, option.caption])).toEqual([
      ['Madrugador', 'owned', 'Conquistado estudando'],
      ['Cem Sessões', 'locked', 'Conclua 100 Study Sessions'],
      ['Selo', 'locked', 'Conclua uma Raid com sua Guilda'],
    ]);
    expect(describeUnlockCondition(badges[2]!)).toBe('Conclua 5 Study Sessions antes das 7h');
    expect(cosmeticItemState(badges[1]!)).toBe('lockedBySessions');
    expect(describeNextUnlock([badges[1]!], 1)).toBe('Os itens desta categoria são conquistados estudando.');
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
    expect(avatarLayerFor({ avatar: { name: 'Avatar sem arte' } })).toBe(initialAvatarLayer);
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

describe('premium items (#354)', () => {
  const premium = (name: string, category: CatalogCosmeticItem['category'], state: Partial<Pick<CatalogCosmeticItem, 'equipped'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category, name, unlockCondition: { type: 'level', level: 1 }, requiresPremium: true, unlocked: true, equipped: false, forSale: false, ...state,
  });
  const initial = (name: string, category: CatalogCosmeticItem['category']): CatalogCosmeticItem => ({
    id: `item-${name}`, category, name, unlockCondition: { type: 'level', level: 1 }, requiresPremium: false, unlocked: true, equipped: false, forSale: false,
  });

  it('captions a premium level-1 item "Plano premium" and never "inicial"', () => {
    const catalog = [
      initial('Capuz do Erudito', 'avatar'), premium('Manto do Arquimago', 'avatar'),
      initial('Espada', 'weapon'), premium('Cajado Astral', 'weapon'),
      initial('Aprendiz', 'title'), premium('Lenda do Foco', 'title'),
    ];

    for (const [category, premiumName, initialName, initialCaption] of [
      ['avatar', 'Manto do Arquimago', 'Capuz do Erudito', 'Avatar inicial'],
      ['weapon', 'Cajado Astral', 'Espada', 'Arma inicial'],
      ['title', 'Lenda do Foco', 'Aprendiz', 'Título inicial'],
    ] as const) {
      const options = optionsFor(catalog, category, 'free');
      expect(options.find((option) => option.item.name === premiumName)).toMatchObject({ availability: { kind: 'premium' }, caption: 'Plano premium' });
      expect(options.find((option) => option.item.name === initialName)?.caption).toBe(initialCaption);
    }
    // Wearing one (the policy flag releases it with no billing) or owning the plan never reads "inicial" either.
    const worn = [premium('Manto do Arquimago', 'avatar', { equipped: true })];
    expect(optionsFor(worn, 'avatar', 'free')[0]?.caption).toBe('Plano premium');
    expect(optionsFor(worn, 'avatar', 'premium')[0]?.caption).toBe('Plano premium');
  });

  it('draws the premium items with their own sprite, not the category default', () => {
    for (const [category, name] of [['avatar', 'Manto do Arquimago'], ['weapon', 'Cajado Astral'], ['title', 'Lenda do Foco']] as const) {
      const own = cosmeticSprite({ category, name });
      expect(own).not.toBe(cosmeticSprite({ category, name: 'Item sem arte' }));
      expect(itemSprites[own]).toBeDefined();
    }
    const sprites = ['Manto do Arquimago', 'Cajado Astral', 'Lenda do Foco'].map((name) => cosmeticSprite({ category: 'title', name }));
    expect(new Set(sprites).size).toBe(3);
  });

  it('draws the Herói layers of the premium Avatar and Arma, different from the initial ones', () => {
    expect(avatarLayerFor({ avatar: { name: 'Manto do Arquimago' } })).toBe(avatarLayers['Manto do Arquimago']);
    expect(avatarLayerFor({ avatar: { name: 'Manto do Arquimago' } })).not.toEqual(avatarLayerFor({ avatar: { name: 'Capuz do Erudito' } }));
    expect(weaponLayers['Cajado Astral']).toBeDefined();
    expect(weaponLayers['Cajado Astral']).not.toEqual(weaponLayers.Cajado);
    expect(weaponLayers['Cajado Astral']).not.toEqual(weaponLayers.Espada);
  });

  it('draws the Cajado Astral weapon layer on the Herói, apart from the Cajado layer', async () => {
    const hero = (weapon: string) => <LayeredHero equipped={{ avatar: null, weapon: { name: weapon }, accessory: null }} scale={4} testID="hero" />;
    const view = await render(hero('Cajado Astral'));
    expect(screen.getByTestId('character-hero-layer-weapon', { includeHiddenElements: true })).toBeTruthy();
    const astral = JSON.stringify(screen.toJSON());
    await view.unmount();
    await render(hero('Cajado'));
    const plain = JSON.stringify(screen.toJSON());
    expect(astral).not.toBe(plain);
  });
});

describe('Pacote do Dragão items (#360)', () => {
  const packItem = (name: string, category: CatalogCosmeticItem['category'], state: Partial<Pick<CatalogCosmeticItem, 'unlocked' | 'equipped'>> = {}): CatalogCosmeticItem => ({
    id: `item-${name}`, category, name, unlockCondition: { type: 'pack', slug: 'dragao' }, requiresPremium: false, unlocked: false, equipped: false, forSale: false, ...state,
  });
  const PACK = [['avatar', 'Elmo de Escamas'], ['weapon', 'Presa do Dragão'], ['accessory', 'Amuleto de Brasa']] as const;

  it('captions an owned Pacote item "Do Pacote do Dragão" and lets a free plan wear it', () => {
    for (const [category, name] of PACK) {
      expect(optionsFor([packItem(name, category, { unlocked: true })], category, 'free')[0])
        .toMatchObject({ availability: { kind: 'owned' }, caption: 'Do Pacote do Dragão' });
    }
  });

  it('captions a Pacote item the user does not own "Do Pacote do Dragão" too, locked', () => {
    expect(optionsFor([packItem('Elmo de Escamas', 'avatar')], 'avatar', 'free')[0])
      .toMatchObject({ availability: { kind: 'locked' }, caption: 'Do Pacote do Dragão' });
    expect(describeUnlockCondition(packItem('Elmo de Escamas', 'avatar'))).toBe('Do Pacote do Dragão');
  });

  it('orders and describes a locked Pacote item with the items for sale, ahead of the Raid items', () => {
    const locked = packItem('Amuleto de Brasa', 'badge');
    const raid: CatalogCosmeticItem = { ...locked, id: 'raid', name: 'Selo', unlockCondition: { type: 'raid', slug: '*' } };
    expect(cosmeticItemState(locked)).toBe('lockedByPurchase');
    expect(describeNextUnlock([locked], 1)).toBe('Os itens desta categoria são comprados na Loja.');
    expect(optionsFor([raid, locked], 'badge', 'free').map((option) => option.item.name)).toEqual(['Amuleto de Brasa', 'Selo']);
  });

  it('places the Presa do Dragão layer exactly where the Figma sprite draws it', () => {
    expect(weaponLayers['Presa do Dragão']?.rows).toEqual([
      '................', '................', '................', '..............a.', '.............aba', '.............aba',
      '............aba.', '............aba.', '............aba.', '............aba.', '...........accca', '............ada.',
      '............ada.', '.............d..', '.............d..', ...Array<string>(9).fill('................'),
    ]);
  });

  it('draws each Pacote item with its own sprite, not the category default', () => {
    for (const [category, name] of PACK) {
      const own = cosmeticSprite({ category, name });
      expect(own).not.toBe(cosmeticSprite({ category, name: 'Item sem arte' }));
      expect(itemSprites[own]).toBeDefined();
    }
  });

  it('draws the Elmo, the Presa and the Amuleto on the Herói, each different from the slot without it and from the nearest existing art', async () => {
    const heroes: HeroLayers[] = [
      { avatar: null, weapon: null, accessory: null },
      { avatar: { name: 'Elmo de Escamas' }, weapon: null, accessory: null },
      { avatar: null, weapon: { name: 'Presa do Dragão' }, accessory: null },
      { avatar: null, weapon: null, accessory: { name: 'Amuleto de Brasa' } },
      { avatar: { name: 'Armadura do Lobo' }, weapon: null, accessory: null },
      { avatar: null, weapon: { name: 'Espada' }, accessory: null },
      { avatar: null, weapon: null, accessory: { name: 'Selo dos Madrugadores' } },
    ];
    await render(<View>{heroes.map((equipped, index) => <LayeredHero key={index} equipped={equipped} scale={4} testID="hero" />)}</View>);
    // The pixels of a Herói are the SVG rects under it (colour and place), hidden from accessibility as they are.
    type Node = { props: { fill?: unknown; x?: number; y?: number; width?: number }; children: Array<Node | string> };
    const pixels = (node: Node | string): string[] => (typeof node === 'string' ? [] : [
      ...(node.props.fill ? [`${JSON.stringify(node.props.fill)}@${node.props.x},${node.props.y}+${node.props.width}`] : []),
      ...node.children.flatMap(pixels),
    ]);
    const drawn = (screen.getAllByTestId('hero', { includeHiddenElements: true }) as unknown as Node[]).map((hero) => pixels(hero).join(' '));
    const [bare, elmo, presa, amuleto, lobo, espada, selo] = drawn;

    expect(drawn).toHaveLength(7);
    expect(new Set([bare, elmo, presa, amuleto]).size).toBe(4);
    expect(elmo).not.toBe(lobo);
    expect(presa).not.toBe(espada);
    expect(amuleto).not.toBe(selo);
  });
});
