import { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { PixelSpriteData } from './sprites';

type PixelRun = { x: number; y: number; width: number; color: string };

/** Merges horizontal runs of the same colour so each row needs as few rects as possible. */
function toRuns({ palette, rows }: PixelSpriteData): PixelRun[] {
  const runs: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row.charAt(x);
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      const color = key === '.' ? undefined : palette[key.charCodeAt(0) - 97];
      if (color) runs.push({ x, y, width: end - x, color });
      x = end;
    }
  });
  return runs;
}

export type PixelSpriteProps = {
  sprite: PixelSpriteData;
  /** Integer scale factor: one sprite pixel becomes `scale` × `scale` screen pixels. */
  scale: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const PixelSprite = memo(function PixelSprite({ sprite, scale, opacity = 1, style, testID }: PixelSpriteProps) {
  if (__DEV__ && !Number.isInteger(scale)) {
    throw new Error('PixelSprite only scales by integer factors.');
  }
  const runs = useMemo(() => toRuns(sprite), [sprite]);
  const columns = sprite.rows[0]?.length ?? 0;

  return (
    <Svg
      aria-hidden
      height={sprite.rows.length * scale}
      opacity={opacity}
      pointerEvents="none"
      style={style}
      testID={testID}
      viewBox={`0 0 ${columns} ${sprite.rows.length}`}
      width={columns * scale}
    >
      {runs.map((run) => <Rect fill={run.color} height={1} key={`${run.x}-${run.y}`} width={run.width} x={run.x} y={run.y} />)}
    </Svg>
  );
});
