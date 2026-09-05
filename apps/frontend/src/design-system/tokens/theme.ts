import type { TextStyle } from 'react-native';

const palette = {
  ink900: '#07070c',
  ink800: '#0c0c14',
  ink700: '#12121c',
  indigo600: '#181826',
  indigo500: '#1f1f2e',
  inkInset: '#0a0a12',
  goldLine08: 'rgba(212, 168, 90, 0.08)',
  goldLine16: 'rgba(212, 168, 90, 0.16)',
  goldLine28: 'rgba(212, 168, 90, 0.28)',
  goldLine45: 'rgba(212, 168, 90, 0.45)',
  gold: '#d4a85a',
  goldBright: '#f0c97a',
  goldDim: '#8a6a3a',
  goldGlow: 'rgba(212, 168, 90, 0.35)',
  red: '#c44545',
  blue: '#5b7fc4',
  green: '#4ea672',
  pink: '#d65a8a',
  purple: '#8a5bc4',
  parchment: '#f3ead4',
  parchmentMuted: '#b3a98e',
  parchmentDim: '#6b6555',
  parchmentDisabled: '#46412f',
} as const;

const spacingScale = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;
const radiusScale = [3, 5, 8, 12, 999] as const;
type TypographyToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'letterSpacing' | 'lineHeight'>;

export const theme = {
  color: {
    backgroundCanvas: palette.ink900,
    backgroundRaised: palette.ink800,
    backgroundOverlay: palette.ink700,
    surfaceCard: palette.indigo600,
    surfaceElevated: palette.indigo500,
    surfaceCardActive: palette.indigo500,
    surfaceInset: palette.inkInset,
    borderGhost: palette.goldLine08,
    borderSubtle: palette.goldLine16,
    borderSoft: palette.goldLine16,
    borderEmphasis: palette.goldLine28,
    borderFocus: palette.goldLine45,
    accentPrimary: palette.gold,
    accentHighlight: palette.goldBright,
    accentMuted: palette.goldDim,
    accentGlow: palette.goldGlow,
    feedbackDanger: palette.red,
    feedbackInfo: palette.blue,
    feedbackSuccess: palette.green,
    feedbackEnergy: palette.pink,
    feedbackArcane: palette.purple,
    textPrimary: palette.parchment,
    textSecondary: palette.parchmentMuted,
    textTertiary: palette.parchmentDim,
    textDisabled: palette.parchmentDisabled,
  },
  space: {
    none: spacingScale[0],
    inlineHairline: spacingScale[1],
    inlineTight: spacingScale[2],
    stackTight: spacingScale[3],
    controlInset: spacingScale[4],
    stackDefault: spacingScale[5],
    cardInset: spacingScale[6],
    sectionGap: spacingScale[7],
    screenGap: spacingScale[8],
    heroGap: spacingScale[9],
    pageGap: spacingScale[10],
  },
  radius: {
    detail: radiusScale[0],
    control: radiusScale[1],
    card: radiusScale[2],
    panel: radiusScale[3],
    pill: radiusScale[4],
  },
  border: { standard: 1, focus: 2 },
  elevation: {
    card: {
      shadowColor: palette.ink900,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  iconSize: { small: 16, medium: 24, large: 32 } as const,
  motion: { none: 0, quick: 120, standard: 180, deliberate: 240 },
  layout: {
    touchTarget: 44,
    sidebarWidth: 248,
    desktopBreakpoint: 900,
    contentMaxWidth: 1200,
    mobileGutter: 16,
    narrowWebGutter: 24,
    wideWebGutter: 32,
  },
  type: {
    display: { fontFamily: 'Cinzel-SemiBold', fontSize: 32, letterSpacing: 1, lineHeight: 40 },
    title: { fontFamily: 'Cinzel-Bold', fontSize: 24, lineHeight: 32 },
    subtitle: { fontFamily: 'Cinzel-SemiBold', fontSize: 18, lineHeight: 26 },
    subtitleStrong: { fontFamily: 'Inter-Bold', fontSize: 18, lineHeight: 26 },
    body: { fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 24 },
    label: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 20 },
    caption: { fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 2, lineHeight: 16 },
    mono: { fontFamily: 'JetBrainsMono-Medium', fontSize: 14, letterSpacing: 1.5, lineHeight: 20 },
    monoEmphasis: { fontFamily: 'JetBrainsMono-SemiBold', fontSize: 14, letterSpacing: 1.5, lineHeight: 20 },
  } satisfies Record<string, TypographyToken>,
} as const;

export type SemanticColor = keyof typeof theme.color;
export type TypographyRole = keyof typeof theme.type;
export type MotionDuration = (typeof theme.motion)[keyof typeof theme.motion];

export function isSemanticColor(color: string): color is SemanticColor {
  return Object.prototype.hasOwnProperty.call(theme.color, color);
}

export function motionDuration(duration: MotionDuration, isReduced: boolean): MotionDuration {
  return isReduced ? theme.motion.none : duration;
}

export function typographyFor(role: TypographyRole, useFallback: boolean): TypographyToken {
  const token = theme.type[role];

  if (!useFallback) return token;

  const fallbackFamily = role === 'display' || role === 'title' ? 'serif' : role.startsWith('mono') ? 'monospace' : undefined;
  return { ...token, fontFamily: fallbackFamily };
}
