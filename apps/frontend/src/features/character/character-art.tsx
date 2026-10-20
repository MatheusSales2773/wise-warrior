import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, FeGaussianBlur, Filter, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { theme } from '@/design-system';

/* Vector layers from the Figma "Painel do herói" and "HeroCard" frames, kept at their exported geometry. */

const hidden = { 'aria-hidden': true, pointerEvents: 'none' } as const;

function svgId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Gold radial "Brilho" behind an equipped hero. */
export function HeroGlow({ height, opacity, style, width }: { height: number; opacity: number; style?: StyleProp<ViewStyle>; width: number }) {
  const id = svgId('hero-glow', useId());
  const rx = width / 2;
  const ry = height / 2;
  return <Svg {...hidden} height={height} style={style} viewBox={`0 0 ${width} ${height}`} width={width}>
    <Ellipse cx={rx} cy={ry} fill={`url(#${id})`} rx={rx} ry={ry} />
    <Defs>
      {/* Bounding-box units stretch the circle into the ellipse, matching Figma's scale(rx ry) transform. */}
      <RadialGradient cx="50%" cy="50%" id={id} r="50%">
        <Stop offset="0" stopColor={theme.color.accentPrimary} stopOpacity={opacity} />
        <Stop offset="1" stopColor={theme.color.accentPrimary} stopOpacity={0} />
      </RadialGradient>
    </Defs>
  </Svg>;
}

const DEFAULT_SHADOW_BLUR = 4;

/**
 * Blurred "Sombra" ellipse the hero stands on; the canvas bleeds past the ellipse so the blur is not clipped.
 * `blur` is the Gaussian standard deviation, i.e. half of Figma's layer-blur radius.
 */
export function GroundShadow({ blur = DEFAULT_SHADOW_BLUR, height, style, width }: { blur?: number; height: number; style?: StyleProp<ViewStyle>; width: number }) {
  const id = svgId('ground-shadow', useId());
  const bleed = blur * 2;
  const canvasWidth = width + bleed * 2;
  const canvasHeight = height + bleed * 2;
  return <Svg {...hidden} height={canvasHeight} style={[{ margin: -bleed }, style]} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} width={canvasWidth}>
    <G filter={`url(#${id})`}>
      <Ellipse cx={canvasWidth / 2} cy={canvasHeight / 2} fill="black" fillOpacity={0.6} rx={width / 2} ry={height / 2} />
    </G>
    <Defs>
      <Filter filterUnits="userSpaceOnUse" height={canvasHeight} id={id} width={canvasWidth} x={0} y={0}>
        <FeGaussianBlur stdDeviation={blur} />
      </Filter>
    </Defs>
  </Svg>;
}

/** Radio from the "Opção" rows of the equipment drawer. */
export function RadioMark({ selected }: { selected: boolean }) {
  return <Svg {...hidden} fill="none" height={20} viewBox="0 0 20 20" width={20}>
    {selected
      ? <Path d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke={theme.color.accentPrimary} strokeWidth={6} />
      : <Circle cx={10} cy={10} r={9.25} stroke={theme.color.accentPrimary} strokeOpacity={0.45} strokeWidth={1.5} />}
  </Svg>;
}
