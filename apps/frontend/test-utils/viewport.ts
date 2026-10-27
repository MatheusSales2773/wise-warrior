/**
 * Platform and window width for tests that render the real navigation. `resetViewport` restores both;
 * call it after each test that changed them.
 */
import { act } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';

const originalPlatform = Platform.OS;
const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');

export async function setViewport(platform: 'web' | 'ios' | 'android', width: number) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  await act(() => {
    Dimensions.set({
      window: { ...originalWindow, width },
      screen: { ...originalScreen, width },
    });
  });
}

export async function resetViewport() {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  await act(() => {
    Dimensions.set({ window: originalWindow, screen: originalScreen });
  });
}
