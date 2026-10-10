/**
 * Pixel art exported from the "Sprites (pixel art)" page of the Wise Figma file.
 * Each row is one line of pixels; a letter indexes `palette` (a = 0, b = 1, …) and `.` is transparent.
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
  mestreDaAurora: {
    palette: ['#0a0a12', '#f0c97a', '#c44545'],
    rows: ['.aaaaaa.', 'abbbbbba', '.abccba.', '.abbbba.', '.abccba.', '.abbbba.', 'abbbbbba', '.aaaaaa.'],
  },
  seloDosMadrugadores: {
    palette: ['#0a0a12', '#c44545', '#7d2a2a', '#d4a85a', '#f0c97a'],
    rows: ['..aaaa..', '.abbbba.', 'abcddcba', 'abdeedba', 'abdeedba', 'abcddcba', '.abbbba.', '..aaaa..'],
  },
  cristalDaAurora: {
    palette: ['#0a0a12', '#a9e0ff', '#5b9fc4'],
    rows: ['...aa...', '..abca..', '.abccba.', 'abcbbcca', 'acbcccba', '.accbca.', '..acca..', '...aa...'],
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
