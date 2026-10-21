/**
 * Pixel art exported from the "Sprites (pixel art)" page of the Wise Figma file.
 * Each row is one line of pixels; a letter indexes `palette` (a = 0, b = 1, …, z = 25, A = 26, …) and `.` is transparent.
 * Sprites must only be scaled by integer factors so pixels stay crisp.
 */
export type PixelSpriteData = {
  palette: readonly string[];
  rows: readonly string[];
};

const heroRobe = [
  '......aaaa......',
  '.....abbbba.....',
  '....abcbbbba....',
  '...abcbbbbbba...',
  '...abdaaaadba...',
  '...adaeeeeada...',
  '...adefeefeda...',
  '...adeeggeeda...',
  '....adeeeeda....',
  '...abhaaaahba...',
  '..abbbhiihbbba..',
  '.abbbbbhhbbbbba.',
  '.abcbbbhhbbbbba.',
  '.aeajjjjjjjjaea.',
  '.aeajkkkkkkjaea.',
  '..aajkkiikkjaa..',
  '..abajjjjjjaba..',
  '..abbbbhhbbbba..',
  '..abcbbhhbbbba..',
  '..abcbbhhbbbda..',
  '.abbbbbhhbbbdda.',
  '.adddddhhddddda.',
  '..aaajjaajjaaa..',
  '...aaaa..aaaa...',
] as const;

const heroArmor = [
  '......aaaa......',
  '....abbccca.....',
  '...abcccccca....',
  '...accdddcca....',
  '...aeaaaaaea....',
  '...aefgfgfea....',
  '...aeffffhea....',
  '....aehhhea.....',
  '..aiacccccaia...',
  '.aijabccccajia..',
  '.aijcbcddcccjia.',
  '.aijcccddcccjia.',
  '.aijeccccccejia.',
  '.aifaeeddeeafia.',
  '.aijaccccccajia.',
  '.aijacceeccajia.',
  'aiijaecaaceajiia',
  'aiijaccaaccajiia',
  'aiiiacca.accaiia',
  '.aiiaeea.aeeaia.',
  '..aaacca.accaaa.',
  '....aeea.aeea...',
  '...aeeea.aeeea..',
  '...aaaaa.aaaaa..',
] as const;

export const heroSprites = {
  erudito: {
    palette: ['#0a0a12', '#5b3fa0', '#8a5bc4', '#3b2770', '#e8b48a', '#07070c', '#b97d5b', '#d4a85a', '#f0c97a', '#7a4a2a', '#f3ead4'],
    rows: heroRobe,
  },
  guerreira: {
    palette: ['#0a0a12', '#c9cfdc', '#8d93a8', '#d4a85a', '#5a5f73', '#e8b48a', '#07070c', '#b97d5b', '#7d2a2a', '#c44545'],
    rows: heroArmor,
  },
  arcanista: {
    palette: ['#0a0a12', '#2f6b8f', '#5b9fc4', '#1d4560', '#e8b48a', '#07070c', '#b97d5b', '#a9e0ff', '#7a4a2a', '#f3ead4'],
    rows: [
      ...heroRobe.slice(0, 9),
      '...abcaaaacba...',
      '..abbbchhcbbba..',
      '.abbbbbccbbbbba.',
      '.abcbbbccbbbbba.',
      '.aeaiiiiiiiiaea.',
      '.aeaijjjjjjiaea.',
      '..aaijjhhjjiaa..',
      '..abaiiiiiiaba..',
      '..abbbbccbbbba..',
      '..abcbbccbbbba..',
      '..abcbbccbbbda..',
      '.abbbbbccbbbdda.',
      '.adddddccddddda.',
      '..aaaiiaaiiaaa..',
      '...aaaa..aaaa...',
    ],
  },
  paladino: {
    palette: ['#0a0a12', '#f0c97a', '#b8963f', '#c44545', '#7a5f28', '#e8b48a', '#07070c', '#b97d5b', '#b3a98e', '#f3ead4'],
    rows: heroArmor,
  },
} as const satisfies Record<string, PixelSpriteData>;

/**
 * The layered Herói (ADR-013): one neutral body plus Avatar, Arma and Acessório layers, all on the 16 × 24 grid of the body.
 * The body keeps the face and hands of the initial class and wears plain cloth; layers are drawn over it and leave
 * the skin transparent, so the face and hands always come from the body.
 */
const heroBodyRows = [
  '................',
  '................',
  '................',
  '................',
  '......aaaa......',
  '.....aeeeea.....',
  '....aefeefea....',
  '....aeeggeea....',
  '.....aeeeea.....',
  '......aeea......',
  '....aabbbbaa....',
  '...abbbbbbbba...',
  '...abccbbbbba...',
  '.aeabbbbbbbbaea.',
  '.aeabbbbbbbbaea.',
  '..aabbbbbbbbaa..',
  '...abbbbbbbba...',
  '...abbddddbba...',
  '...abba..abba...',
  '...abba..abba...',
  '...abba..abba...',
  '...abba..abba...',
  '..aaaa....aaaa..',
  '................',
] as const;

export const heroBody: PixelSpriteData = {
  palette: ['#0a0a12', '#6b7086', '#8d93a8', '#4a4e60', '#e8b48a', '#07070c', '#b97d5b'],
  rows: heroBodyRows,
};

export const GRID_WIDTH = 16;
export const GRID_HEIGHT = 24;

const FACE_ROWS = [5, 6, 7, 8];
const HAND_ROWS = [13, 14];

/** An Avatar layer cut from a full-body sprite: its face and hands (skin `e`, eyes `f`, shade `g`) become transparent. */
function avatarLayerFrom(sprite: PixelSpriteData): PixelSpriteData {
  return {
    palette: sprite.palette,
    rows: sprite.rows.map((row, y) => {
      if (FACE_ROWS.includes(y)) return row.replace(/[efg]/g, '.');
      if (HAND_ROWS.includes(y)) return row.replace(/e/g, '.');
      return row;
    }),
  };
}

/** The initial Avatar's layer, drawn when the slot is empty or the equipped Avatar has no art of its own yet. */
export const initialAvatarLayer: PixelSpriteData = avatarLayerFrom(heroSprites.erudito);

/** Avatar layers by Catalog name. */
export const avatarLayers: Readonly<Record<string, PixelSpriteData>> = {
  'Capuz do Erudito': initialAvatarLayer,
  'Manto Estelar': avatarLayerFrom(heroSprites.arcanista),
};

/** Acessório layers by Catalog name; an Acessório without one is only shown in its slot. */
export const accessoryLayers: Readonly<Record<string, PixelSpriteData>> = {
  'Selo dos Madrugadores': {
    palette: ['#0a0a12', '#c44545', '#d4a85a'],
    rows: [
      ...Array<string>(11).fill('................'),
      '.........aba....',
      '.........bcb....',
      '.........aba....',
      ...Array<string>(10).fill('................'),
    ],
  },
  'Pena do Escriba': {
    palette: ['#0a0a12', '#f3ead4', '#d4a85a'],
    rows: [
      '................',
      '.............aa.',
      '............abba',
      '...........abba.',
      ...Array<string>(20).fill('................'),
    ],
  },
};

/** Builds a 16 × 24 layer from rows placed by `[y, x, pixels]`, so an Arma is drawn where the hand holds it. */
function layerAt(placements: readonly (readonly [number, number, string])[]): readonly string[] {
  const rows = Array<string>(GRID_HEIGHT).fill('.'.repeat(GRID_WIDTH));
  for (const [y, x, pixels] of placements) rows[y] = rows[y]!.slice(0, x) + pixels + rows[y]!.slice(x + pixels.length);
  return rows;
}

/**
 * Arma layers by Catalog name (ADR-013). Each is a full 16 × 24 layer: the sprite itself says where the Arma sits,
 * gripped in the right hand of the body (column 13, rows 13 and 14), where each Arma paints only the hand pixels. An Arma without one leaves the Herói unarmed.
 */
export const weaponLayers: Readonly<Record<string, PixelSpriteData>> = {
  Espada: {
    palette: ['#0a0a12', '#c9d1e0', '#d4a85a', '#7a5f28'],
    rows: layerAt([
      [3, 12, '.a.'], [4, 12, 'aba'], [5, 12, 'aba'], [6, 12, 'aba'], [7, 12, 'aba'], [8, 12, 'aba'], [9, 12, 'aba'],
      [10, 11, 'accca'], [11, 12, 'ada'], [12, 12, 'ada'], [13, 13, 'd'], [14, 13, 'd'],
    ]),
  },
  Cajado: {
    palette: ['#0a0a12', '#8a5a2b', '#6fd0ff', '#e0f6ff'],
    rows: layerAt([
      [0, 12, '.a.'], [1, 12, 'aca'], [2, 12, 'cdc'], [3, 12, 'aca'],
      ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20].map((y) => [y, 12, 'aba'] as const),
      [13, 13, 'b'], [14, 13, 'b'], [21, 13, 'a'],
    ]),
  },
  Besta: {
    palette: ['#0a0a12', '#8a5a2b', '#f3ead4', '#c9d1e0'],
    rows: layerAt([
      [6, 13, 'd'], [7, 13, 'd'], [8, 11, 'abbba'], [9, 11, 'acdca'],
      [10, 12, 'aba'], [11, 12, 'aba'], [12, 12, 'aba'], [13, 13, 'b'], [14, 13, 'b'],
    ]),
  },
};

export const itemSprites = {
  capuzDoErudito: {
    palette: ['#0a0a12', '#5b3fa0', '#8a5bc4', '#e8b48a'],
    rows: ['..aaaa..', '.abbbba.', 'abcbbbba', 'abaaaaba', 'abaddaba', 'abaddaba', '.abbbba.', '..aaaa..'],
  },
  mantoDaVigilia: {
    palette: ['#0a0a12', '#5b7fc4', '#d4a85a', '#2f4a80'],
    rows: ['..aaaa..', '.abccba.', 'abbbbbba', 'abdbbdba', 'abdbbdba', 'abdbbdba', 'addbbdda', 'aaaaaaaa'],
  },
  madrugadorV: {
    palette: ['#d4a85a', '#f0c97a', '#f3ead4'],
    rows: ['...aa...', '.a.bb.a.', '..bbbb..', 'abbccbba', 'abbccbba', '..bbbb..', '.a.bb.a.', '...aa...'],
  },
  cemSessoes: {
    palette: ['#0a0a12', '#d4a85a', '#f3ead4', '#f0c97a'],
    rows: ['aaaaaaaa', '.abbbba.', '..abba..', '...aa...', '...aa...', '..acca..', '.acddca.', 'aaaaaaaa'],
  },
  estudanteCrepuscular: {
    palette: ['#0a0a12', '#f3ead4', '#7a4a2a'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  /** The Guild coin of the Figma 06c, a proposal: not an item of the catalog. */
  moedaDaGuilda: {
    palette: ['#3a2a10', '#f0c97a', '#b8863a', '#fff6dc'],
    rows: ['..aaaa..', '.abbbca.', 'abbdbbca', 'abdbbbca', 'abbbbbca', 'abbbbcca', '.acccca.', '..aaaa..'],
  },
  mestreDaAurora: {
    palette: ['#0a0a12', '#f0c97a', '#c44545'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  seloDosMadrugadores: {
    palette: ['#0a0a12', '#c44545', '#7d2a2a', '#d4a85a', '#f0c97a'],
    rows: ['..aaaa..', '.abbbba.', 'abcddcba', 'abdeedba', 'abdeedba', 'abcddcba', '.abbbba.', '..aaaa..'],
  },
  plumaDeGrifo: {
    palette: ['#0a0a12', '#c9a37a', '#f3ead4', '#d4a85a'],
    rows: ['.....aa.', '....abca', '...abcca', '..abccba', '.abccba.', 'dabcba..', 'da.aa...', 'd.......'],
  },
  sinoDaTorre: {
    palette: ['#0a0a12', '#d4a85a', '#f0c97a', '#7a5f28'],
    rows: ['...aa...', '..abba..', '.abccba.', '.abbbba.', 'abbbbbba', 'abdddbba', 'aaaaaaaa', '..adda..'],
  },
  chaveDaTorre: {
    palette: ['#0a0a12', '#b3a98e', '#f3ead4', '#7a7466'],
    rows: ['.aaaa...', 'abccba..', 'ab.cba..', 'abccba..', '.abba...', '.abba...', '.abdbaa.', '.abdbba.'],
  },
  ancoraDasBrumas: {
    palette: ['#0a0a12', '#5b9fc4', '#a9e0ff', '#2f4a80'],
    rows: ['..aaaa..', '..abba..', '.aaabaa.', '...bb...', 'a..bb..a', 'abbbbbba', '.abbbba.', '..aaaa..'],
  },
  medalhaoDoLobo: {
    palette: ['#0a0a12', '#b3a98e', '#f3ead4', '#c44545', '#7a7466'],
    rows: ['a.aaaa.a', 'abaccaba', 'abbbbbba', 'abcbbcba', 'abbddbba', '.abbbba.', '..abba..', '...aa...'],
  },
  armaduraDoLobo: {
    palette: ['#0a0a12', '#7a7466', '#b3a98e', '#c44545'],
    rows: ['a.aaaa.a', 'abaccaba', 'abbbbbba', 'abdbbdba', 'abbbbbba', 'abcbbcba', 'abbbbbba', '.aaaaaa.'],
  },
  naveganteDasBrumas: {
    palette: ['#0a0a12', '#a9e0ff', '#2f4a80'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  cacadorDeMonstros: {
    palette: ['#0a0a12', '#b3a98e', '#c44545'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  espada: {
    palette: ['#0a0a12', '#c9d1e0', '#d4a85a', '#7a5f28'],
    rows: ['......aa', '.....aba', '....aba.', 'a..aba..', 'acaba...', '.acca...', '.adca...', 'aa.aa...'],
  },
  cajado: {
    palette: ['#0a0a12', '#8a5a2b', '#6fd0ff', '#e0f6ff'],
    rows: ['....aaa.', '...acda.', '...acca.', '....aaa.', '...ab...', '..ab....', '.ab.....', 'aa......'],
  },
  besta: {
    palette: ['#0a0a12', '#8a5a2b', '#f3ead4', '#c9d1e0'],
    rows: ['...aa...', '...ad...', 'aaabbaaa', 'acbddbca', '.aabbaa.', '...ab...', '...ab...', '...aa...'],
  },
  cristalDaAurora: {
    palette: ['#0a0a12', '#a9e0ff', '#5b9fc4'],
    rows: ['...aa...', '..abca..', '.abccba.', 'abcbbcca', 'acbcccba', '.accbca.', '..acca..', '...aa...'],
  },
  marcadorDeFita: {
    palette: ['#0a0a12', '#c44545', '#f0c97a'],
    rows: ['.aaaaaa.', 'abbbbbba', 'abbccbba', 'abbccbba', 'abbbbbba', 'abbbbbba', 'abbaabba', '.aa..aa.'],
  },
  guardiaoDasPaginas: {
    palette: ['#0a0a12', '#a9e0ff', '#2f4a80'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  penaDoEscriba: {
    palette: ['#0a0a12', '#f3ead4', '#d4a85a', '#7a4a2a'],
    rows: ['.....aa.', '....abba', '...abbba', '..abbbca', '.abbbca.', 'abbcca..', 'adca....', 'aa......'],
  },
  andarilhoDoSaber: {
    palette: ['#0a0a12', '#a8d5a2', '#3f7a4a'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  tunicaDoViajante: {
    palette: ['#0a0a12', '#3f7a4a', '#d4a85a', '#2a4f31'],
    rows: ['..aaaa..', '.abccba.', 'abbbbbba', 'abdbbdba', 'abdbbdba', 'abdbbdba', 'addbbdda', 'aaaaaaaa'],
  },
  lanternaDoVigia: {
    palette: ['#0a0a12', '#7a4a2a', '#f0c97a', '#fff3b0'],
    rows: ['..aaaa..', '..a..a..', '.abbbba.', 'abcddcba', 'abcddcba', 'abcddcba', '.abbbba.', '..aaaa..'],
  },
  arquimagoDosPrazos: {
    palette: ['#0a0a12', '#e0c3ff', '#8a5bc4'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  mantoEstelar: {
    palette: ['#0a0a12', '#2a1f5e', '#f0c97a', '#5b3fa0'],
    rows: ['..aaaa..', '.abccba.', 'abbbbbba', 'abdbbdba', 'abdbbdba', 'abdbbdba', 'addbbdda', 'aaaaaaaa'],
  },
  marcadorDoGrimorio: {
    palette: ['#0a0a12', '#5b3fa0', '#d4a85a', '#8a5bc4'],
    rows: ['.aaaaaa.', 'abbbbbba', 'abcbbcba', 'abbccbba', 'abbccbba', 'abbbbbba', 'abbaabba', '.aa..aa.'],
  },
  lanternaDoSilencio: {
    palette: ['#0a0a12', '#5b7fc4', '#a9e0ff', '#e8f6ff'],
    rows: ['..aaaa..', '..a..a..', '.abbbba.', 'abcddcba', 'abcddcba', 'abccccba', '.abbbba.', '..aaaa..'],
  },
  brasaoDaForja: {
    palette: ['#0a0a12', '#7a4a2a', '#e8803a', '#f0c97a'],
    rows: ['aaaaaaaa', 'abbbbbba', 'abcddcba', 'abbddbba', 'abbccbba', '.abccba.', '..abba..', '...aa...'],
  },
} as const satisfies Record<string, PixelSpriteData>;

export const companionSprites = {
  coruja: {
    palette: ['#0a0a12', '#7a4a2a', '#f3ead4', '#07070c', '#f0c97a', '#c9a37a', '#d4a85a'],
    rows: ['..a....a..', '.aba..aba.', '.abbbbbba.', 'abccbbccba', 'abcdbbdcba', 'abbbeebbba', '.abffffba.', '.abffffba.', '..abbbba..', '...gaag...'],
  },
} as const satisfies Record<string, PixelSpriteData>;

export type HeroSpriteName = keyof typeof heroSprites;
export type ItemSpriteName = keyof typeof itemSprites;
