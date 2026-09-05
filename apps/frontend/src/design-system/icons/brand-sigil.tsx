import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../tokens/theme';

export function BrandSigil() {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <Circle cx="88" cy="88" r="70" fill="none" stroke={theme.color.borderSubtle} strokeWidth={theme.border.standard} />
      <Circle cx="88" cy="88" r="52" fill="none" stroke={theme.color.borderGhost} strokeWidth={theme.border.standard} />
      <Path
        d="M88 28 102 70 146 70 110 96 124 138 88 112 52 138 66 96 30 70 74 70Z"
        fill="none"
        stroke={theme.color.borderEmphasis}
        strokeLinejoin="round"
        strokeWidth={theme.border.standard}
      />
    </Svg>
  );
}
