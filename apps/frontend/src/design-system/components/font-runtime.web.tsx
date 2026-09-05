import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { fontAssets } from '../tokens/font-assets.web';
import { FontFallbackProvider } from './font-context';

export { useFontFallback } from './font-context';

export function FontGate({ children }: PropsWithChildren) {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const splashWasHidden = useRef(false);
  const runtimeReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (!runtimeReady || splashWasHidden.current) return;

    splashWasHidden.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [runtimeReady]);

  if (!runtimeReady) return null;

  return <FontFallbackProvider enabled={Boolean(fontError)}>{children}</FontFallbackProvider>;
}
