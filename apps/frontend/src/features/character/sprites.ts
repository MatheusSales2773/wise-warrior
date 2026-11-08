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

export const FACE_ROWS = [5, 6, 7, 8];
export const HAND_ROWS = [13, 14];
/** The palette keys of the body's skin, eyes and skin shade: the pixels a layer must leave to the body. */
export const SKIN_KEYS = 'efg';

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

/** The Druida of the Figma sprites page (green robe): not a class of the Herói, only the source of an Avatar layer. */
const druida: PixelSpriteData = {
  palette: ['#0a0a12', '#3f7a4a', '#6fb07a', '#25502e', '#e8b48a', '#07070c', '#b97d5b', '#d4a85a', '#f0c97a', '#7a4a2a', '#f3ead4'],
  rows: heroRobe,
};

/** The initial Avatar's layer, drawn when the slot is empty or the equipped Avatar has no art of its own yet. */
export const initialAvatarLayer: PixelSpriteData = avatarLayerFrom(heroSprites.erudito);

/** The colours of a robe-shaped Avatar: `cloth` is outline, body, highlight and shade; `trim` is the trim, its highlight, the belt and the belt's highlight. */
type RobePalette = { cloth: readonly [string, string, string, string]; trim: readonly [string, string, string, string] };

/** The palette in the key order of `heroRobe`: the body's skin slots (`e`, `f`, `g`) sit between the cloth and the trim. */
function robePalette({ cloth, trim }: RobePalette): readonly string[] {
  return [...cloth, '#e8b48a', '#07070c', '#b97d5b', ...trim];
}

/** An Avatar drawn on the robe silhouette of the initial class, with its own rows and colours, cut like any layer. */
function robeLayer(palette: RobePalette, edit: (rows: string[]) => void = () => {}): PixelSpriteData {
  const rows: string[] = [...heroRobe];
  edit(rows);
  return avatarLayerFrom({ palette: robePalette(palette), rows });
}

/** Avatar layers by Catalog name: every Avatar of the Catalog has one, drawn on the 16 × 24 grid of the body (#261). */
export const avatarLayers: Readonly<Record<string, PixelSpriteData>> = {
  'Capuz do Erudito': initialAvatarLayer,
  /** A plain night cloak with a gold clasp and no belt; on the Figma sprites page as Sprite/Avatar/Manto da Vigília. */
  'Manto da Vigília': robeLayer(
    { cloth: ['#0a0a12', '#5b7fc4', '#8fb0e8', '#2f4a80'], trim: ['#d4a85a', '#f0c97a', '#7a5f28', '#f3ead4'] },
    (rows) => {
      for (const y of [13, 14, 15, 16]) rows[y] = rows[y]!.replace(/[jk]/g, (key) => (key === 'j' ? 'b' : 'c'));
      rows[17] = '..abbbbiibbbba..';
    },
  ),
  /** The green robe of the Figma sprites page, worn by the traveler. */
  'Túnica do Viajante': avatarLayerFrom(druida),
  'Manto Estelar': avatarLayerFrom(heroSprites.arcanista),
  /**
   * The premium sorcerer's coat (✦), after the mages of The Witcher 3: a dark cowl edged in silver, a high collar with silver
   * pauldrons and a gold clasp, an open coat lined in crimson over a linen tunic, a leather corset with a crimson sash and
   * a silver-embroidered hem. On the Figma sprites page as Sprite/Avatar/Manto do Arquimago.
   */
  'Manto do Arquimago': avatarLayerFrom({
    palette: [
      '#0a0a12', '#3d364c', '#655b7e', '#272132', '#e8b48a', '#07070c', '#b97d5b',
      '#c9cfdc', '#f3f5fa', '#4a2e1e', '#7a2a3a', '#b04a5a', '#d8d0bc', '#f0c97a',
    ],
    rows: [
      '......aaaa......',
      '.....abbbba.....',
      '....abcbbbda....',
      '...abcbbbbbda...',
      '...abhaaaahba...',
      '..abha....ahba..',
      '..abd......dba..',
      '..abd......dba..',
      '...abd....dba...',
      '..ahhaa..aahha..',
      '.ahhhbknnkbhhha.',
      '.abcbbkmmkbbbda.',
      '.abcbhkmmkhbbda.',
      '.a.ajjjnnjjja.a.',
      '.a.akjjjjjjja.a.',
      '..aakbkmmkbbaa..',
      '..abkbkmmkbbba..',
      '..abkckmmkcbba..',
      '..akbbkmmkbbda..',
      '..albbkmmkbbda..',
      '.akbbbkmmkbbdda.',
      '.ahhihkmmkhihha.',
      '..aaajjaajjaaa..',
      '...aaaa..aaaa...',
    ],
  }),
  /** Pacote do Dragão (#360): a red-scaled dragon helm with gold horns and an ember gorget; on the Figma sprites page as Sprite/Avatar/Elmo de Escamas. */
  'Elmo de Escamas': {
    palette: ['#0a0a12', '#9a2f2a', '#d4553a', '#5a1a18', '#f0c97a', '#ffe3a0', '#3a1410', '#f3ead4'],
    rows: [
      '....a.aaaa.a....',
      '....aabbbbaa....',
      '....abcbbbba....',
      '...abcbbbbbba...',
      '...abdaaaadba...',
      '...ada....ada...',
      '...ad......da...',
      '...ad......da...',
      '....ad....da....',
      '...abeaaaaeba...',
      '..abbbeffebbba..',
      '.abdbdbeedbdbda.',
      '.adcdbdeebdbdba.',
      '.a.agggggggga.a.',
      '.a.aghhhhhhga.a.',
      '..aaghhffhhgaa..',
      '..abaggggggaba..',
      '..adbdbeedbdba..',
      '..abcbdeebdbda..',
      '..adcdbeedbdda..',
      '.adbdbdeebdbdda.',
      '.adddddeeddddda.',
      '..aaaggaaggaaa..',
      '...aaaa..aaaa...',
    ],
  },
  /** Wolf pelt armour with pointed ears on the hood and red-trimmed pauldrons; on the Figma sprites page as Sprite/Avatar/Armadura do Lobo. */
  'Armadura do Lobo': robeLayer(
    { cloth: ['#0a0a12', '#7a7466', '#b3a98e', '#4a463c'], trim: ['#c44545', '#e87070', '#2a2820', '#f3ead4'] },
    (rows) => {
      rows[0] = '.....a.aa.a.....';
      rows[10] = '..ahhhhiihhhha..';
    },
  ),
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
  /** Pacote do Dragão (#360): an ember on a gold chain over the chest; on the Figma sprites page as Sprite/Acessório/Amuleto de Brasa. */
  'Amuleto de Brasa': {
    palette: ['#d4a85a', '#0a0a12', '#ff9a4a'],
    rows: [
      ...Array<string>(10).fill('................'),
      '......a..a......',
      '.......bb.......',
      '......bccb......',
      '.......bb.......',
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
  /** Pacote do Dragão (#360): a curved ivory fang with a crimson grip; on the Figma sprites page as Sprite/Arma/Presa do Dragão. */
  'Presa do Dragão': {
    palette: ['#0a0a12', '#f3ead4', '#c44545', '#7d2a2a'],
    rows: layerAt([
      [3, 14, 'a'], [4, 13, 'aba'], [5, 13, 'aba'], [6, 12, 'aba'], [7, 12, 'aba'], [8, 12, 'aba'], [9, 12, 'aba'],
      [10, 11, 'accca'], [11, 12, 'ada'], [12, 12, 'ada'], [13, 13, 'd'], [14, 13, 'd'],
    ]),
  },
  /** Item premium ✦ of the Assinatura (#354): the Cajado with a violet shaft and a five-point gold crown, until the Figma art is approved. */
  'Cajado Astral': {
    palette: ['#0a0a12', '#5b3fa0', '#f0c97a', '#fff6dc'],
    rows: layerAt([
      [0, 11, 'a.a.a'], [1, 11, 'acdca'], [2, 12, 'aca'], [3, 12, 'aba'],
      ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20].map((y) => [y, 12, 'aba'] as const),
      [13, 13, 'b'], [14, 13, 'b'], [21, 13, 'a'],
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
  /** The Cajado Astral and Lenda do Foco (#354), recoloured from existing art until the Figma sprites are approved. */
  cajadoAstral: {
    palette: ['#0a0a12', '#5b3fa0', '#f0c97a', '#fff6dc'],
    rows: ['.a.aa.a.', '..acda..', '...aa...', '...bb...', '...bb...', '...bb...', '...bb...', '...aa...'],
  },
  lendaDoFoco: {
    palette: ['#0a0a12', '#f0c97a', '#5b3fa0', '#fff6dc'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abddba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
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
  mantoDoArquimago: {
    palette: ['#0a0a12', '#3d364c', '#c9cfdc', '#7a2a3a', '#f0c97a', '#d8d0bc', '#4a2e1e'],
    rows: ['...aa...', '..abba..', '.acbbca.', 'abdeedba', 'abdffdba', 'aggeegga', 'acdffdca', 'aaaaaaaa'],
  },
  /** Pacote do Dragão (#360), from the Figma sprites page (Sprite/Item/…). */
  elmoDeEscamas: {
    palette: ['#f0c97a', '#0a0a12', '#9a2f2a', '#d4553a'],
    rows: ['a......a', 'ab.bb.ba', '.bccccb.', 'bcdcdccb', 'bccccccb', 'bcbbbbcb', '.bccccb.', '..bbbb..'],
  },
  presaDoDragao: {
    palette: ['#0a0a12', '#f3ead4', '#c44545', '#7d2a2a'],
    rows: ['......aa', '.....aba', '....aba.', '...aba..', 'acaba...', '.ada....', 'ada.....', '.a......'],
  },
  amuletoDeBrasa: {
    palette: ['#d4a85a', '#0a0a12', '#c44545', '#ff9a4a'],
    rows: ['a......a', '.a....a.', '..a..a..', '...bb...', '..bccb..', '.bcddcb.', '..bccb..', '...bb...'],
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

/** Sprite/Chefe/Dragão — O Devorador de Horas, exportado do Figma (App v2, Monetização): o dragão sozinho, sem os efeitos de chama da cena da Raid. 57 × 41 pixels; escale só por inteiros. */
export const dragaoDevoradorDeHoras: PixelSpriteData = {
  palette: ['#1a0a0e', '#f3ead4', '#7d2a2a', '#e06a5a', '#c44545', '#f0c97a', '#5a1a1e', '#3a0d12', '#d4a85a'],
  rows: [
    '................a.............a..........................',
    '.........aaa...aba...........acaaaa......................',
    '........abbba.abba..........adddcccaaaa..................',
    '........abba.abbba..........addccccccccaaaa..............',
    '........abba.abba...........addcccccccccccca.............',
    '........abbaabba............addccccccccccddda............',
    '........abbabba............addccccccccccdddccaa..........',
    '......aaabbebba............addcccccccccdddccccca.........',
    '.....aeeebeeeeea...........addccccccccdddccccccca........',
    '.aaaadddddddeeeea..........addcccccccdddcccccccccaa......',
    'aeeeeeeeeeffeeeea.........addcccccccdddccccccccdddda.....',
    '.aeeeeeeeeeaeeeeea........addccccccdddcccccccddddda......',
    '.aeeeeeeeeeeeddeea........addcccccddcccccccdddddca.......',
    '.aeeeeeeeeeeeddeega......addcccccdddccccddddddcca........',
    '.abhbhbhbheeeeddegga.....addcccdddccccdddddaaaaa.........',
    '.ahbhbhbhbeeeeeddeeaa....addccdddcccdddddca..............',
    '.aeeeeeeeeaeeeeddeeega...addcdddccdddddcca...............',
    '..aaaaaaaa.aeeeeddeegga.addcdddddddddaccca...............',
    '............aeeedddeea.agdddddddddgaa.aaa................',
    '.............aeeeddeeeaaggddddddccggaaga.................',
    '.............aeeeeddeeeaaddeeeeeeeeeaagga................',
    '..............aeeeddeeeeeeeeeeeeeeeeeeeaa...............a',
    '...............aeeeeeeeeeeeeeeeeeeeeeeeeea.............ac',
    '................aeeeeeeeeeeeeeeeeeeeeeeeeea..a.........aa',
    '................aeeeeeeeeeeeeeeeeeeeeeeeeeeaaga.......aca',
    '.................aeeeeeeeeeeeeeeeeeeeeeeeeeeagga.a...aaca',
    '..................aeeeeeeeeeeeeeeeeeeeeeeeeeaaa.aga.aecca',
    '.................aeeeeeeeeeeeeeeeeeeeeeeeeeeeaaaaggaeecca',
    '..................aeeeeeeefffffffeeeeeeeeeeeeeeeaaaeeccca',
    '..................aeeeiiiiiiiiiiiiiiieeeeeeeeeeeeaeeeeea.',
    '...................affffffffffffffffffeeeeeeeeeeeeeeeea..',
    '...................aiiiiiiiiiiiiiiiiiiccccccceeeeeeeea...',
    '..................aeeeeeefffffffffcccccccaacceeeeeeea....',
    '..................aeeeeeeiiccccciiccccccca.aaaeeeeeea....',
    '..................aeeeeeeaaccccceeccccccca....aeeeea.....',
    '..................aeeeeeeaacccccaaccccccca.....aaaa......',
    '..................aeeeeeeaacccccaaccccccca...............',
    '..................aeeeeeeaacccccaaccccccca...............',
    '..................aaaaaaa.aaaaaa.aaaaaaaa................',
    '.................abababa.abababaabababa..................',
    '..................a.a.a...a.a.a..a.a.a...................',
  ],
};
