import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { FontFallbackProvider } from './font-context';

export { useFontFallback } from './font-context';

export function FontGate({ children }: PropsWithChildren) {
  const splashWasHidden = useRef(false);

  useEffect(() => {
    if (splashWasHidden.current) return;

    splashWasHidden.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return <FontFallbackProvider enabled={false}>{children}</FontFallbackProvider>;
}
