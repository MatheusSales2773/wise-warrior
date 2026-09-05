import type { PlatformOSType } from 'react-native';
import { theme } from './theme';

export function isDesktopLayout(platform: PlatformOSType, width: number): boolean {
  return platform === 'web' && width >= theme.layout.desktopBreakpoint;
}
