import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { FontGate } from '@/design-system/components/font-runtime';
import { MotionRuntime, useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { theme } from '@/design-system/tokens/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RuntimeStack() {
  const duration = useRuntimeMotionDuration();

  return (
    <>
      <Stack
        screenOptions={{
          animation: duration === theme.motion.none ? 'none' : 'fade',
          animationDuration: duration,
          contentStyle: { backgroundColor: theme.color.backgroundCanvas },
          headerShown: false,
        }}
      />
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <FontGate>
      <MotionRuntime>
        <RuntimeStack />
      </MotionRuntime>
    </FontGate>
  );
}
