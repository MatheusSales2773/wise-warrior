import type { PlatformOSType } from 'react-native';
import { theme } from './theme';

export function isDesktopLayout(platform: PlatformOSType, width: number): boolean {
  return platform === 'web' && width >= theme.layout.desktopBreakpoint;
}

export function screenGutter(platform: PlatformOSType, width: number): number {
  if (isDesktopLayout(platform, width)) return theme.layout.wideWebGutter;
  return platform === 'web' ? theme.layout.narrowWebGutter : theme.layout.mobileGutter;
}
