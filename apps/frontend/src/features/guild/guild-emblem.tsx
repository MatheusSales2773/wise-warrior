import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/design-system';

/** Each hue is a theme accent, so the emblem stays inside the palette. */
const EMBLEM_COLORS = [
  theme.color.accentPrimary,
  theme.color.feedbackDanger,
  theme.color.feedbackInfo,
  theme.color.feedbackSuccess,
  theme.color.feedbackEnergy,
  theme.color.feedbackArcane,
] as const;

/** Shield outlines in the Figma GuildSigil's 42 × 42 box; the first one is the Figma shape. */
const EMBLEM_SHIELDS = [
  'M21 2.52L36.12 9.24V21.84C36.12 29.4 29.4 36.12 21 39.48C12.6 36.12 5.88 29.4 5.88 21.84V9.24L21 2.52Z',
  'M8.4 4.2H33.6V22.68C33.6 30.24 27.3 35.7 21 39.48C14.7 35.7 8.4 30.24 8.4 22.68V4.2Z',
  'M21 2.52L35.7 8.4V23.1L21 39.48L6.3 23.1V8.4L21 2.52Z',
  'M6.3 6.3C12.6 6.3 16.8 4.62 21 2.52C25.2 4.62 29.4 6.3 35.7 6.3V21.84C35.7 29.4 29.4 36.12 21 39.48C12.6 36.12 6.3 29.4 6.3 21.84V6.3Z',
] as const;

/** Charges drawn inside the shield; the first one is the Figma sword. */
const EMBLEM_CHARGES = [
  'M21 11.76V15.12M21 15.12V26.88M21 15.12H18.48M21 15.12H23.52M18.48 25.2L21 27.72L23.52 25.2',
  'M21 11.76L23.1 17.64L29.4 17.9L24.4 21.8L26.2 27.86L21 24.36L15.8 27.86L17.6 21.8L12.6 17.9L18.9 17.64L21 11.76Z',
  'M13.86 26.04V15.12L17.64 20.16L21 13.44L24.36 20.16L28.14 15.12V26.04H13.86Z',
  'M21 11.76L27.3 21L21 30.24L14.7 21L21 11.76Z',
] as const;

export type GuildEmblemLook = { color: string; shield: string; charge: string };

/** FNV-1a: small, dependency free, and the same on every platform. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}

/** Derives the emblem from the Guild `id` alone: the API has no Guild image, and the same `id` always gives the same emblem. */
export function guildEmblemFor(guildId: string): GuildEmblemLook {
  const hash = hashId(guildId);
  const shieldHash = Math.floor(hash / EMBLEM_COLORS.length);
  const chargeHash = Math.floor(shieldHash / EMBLEM_SHIELDS.length);
  return {
    color: EMBLEM_COLORS[hash % EMBLEM_COLORS.length] ?? theme.color.accentPrimary,
    shield: EMBLEM_SHIELDS[shieldHash % EMBLEM_SHIELDS.length] ?? EMBLEM_SHIELDS[0],
    charge: EMBLEM_CHARGES[chargeHash % EMBLEM_CHARGES.length] ?? EMBLEM_CHARGES[0],
  };
}

export type GuildEmblemProps = {
  guildId: string;
  name: string;
  size?: number;
  /** Hides the emblem from assistive technology, for when the Guild name is already beside it. */
  decorative?: boolean;
};

export function GuildEmblem({ guildId, name, size = 42, decorative = false }: GuildEmblemProps) {
  const { color, shield, charge } = guildEmblemFor(guildId);
  const a11yProps = decorative
    ? ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: `Emblema da guilda ${name}` } as const);
  return (
    <View {...a11yProps} testID="guild-emblem">
      <Svg height={size} viewBox="0 0 42 42" width={size}>
        <Path d={shield} fill={color} fillOpacity={0.06} stroke={color} strokeLinejoin="round" strokeWidth={0.84} />
        <Path d={charge} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.26} />
      </Svg>
    </View>
  );
}
