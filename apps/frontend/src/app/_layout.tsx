import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/core/auth/auth-context';
import { theme } from '@/design-system';
import { FontGate } from '@/design-system/components/font-runtime';
import { MotionRuntime, useRuntimeMotionDuration } from '@/design-system/components/motion-runtime';
import { SessionRestoringScreen, SessionUnavailableScreen } from '@/features/auth/components/SessionGate';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RuntimeStack() {
  const duration = useRuntimeMotionDuration();
  const { status, retryRestore } = useAuth();

  if (status === 'restoring') {
    return <SessionRestoringScreen />;
  }

  if (status === 'unavailable') {
    return <SessionUnavailableScreen onRetry={retryRestore} />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          animation: duration === theme.motion.none ? 'none' : 'fade',
          animationDuration: duration,
          contentStyle: { backgroundColor: theme.color.backgroundCanvas },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={status === 'anonymous'}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FontGate>
        <MotionRuntime>
          <AuthProvider>
            <RuntimeStack />
          </AuthProvider>
        </MotionRuntime>
      </FontGate>
    </SafeAreaProvider>
  );
}
