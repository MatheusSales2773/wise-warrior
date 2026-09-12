import Svg, { Path } from 'react-native-svg';
import { theme } from '../tokens/theme';

export function BrandSigil({ size = 176 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M20 4 34 12V28L20 36 6 28V12Z"
        fill={theme.color.borderGhost}
        stroke={theme.color.borderEmphasis}
        strokeLinejoin="round"
        strokeWidth={theme.border.standard}
      />
      <Path
        d="M20 12V26M16 22L20 28 24 22M16 16H24"
        fill="none"
        stroke={theme.color.accentPrimary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.4}
      />
    </Svg>
  );
}
