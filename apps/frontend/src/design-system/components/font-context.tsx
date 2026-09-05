import { createContext, type PropsWithChildren, useContext } from 'react';

const FontFallbackContext = createContext(false);

export function useFontFallback(): boolean {
  return useContext(FontFallbackContext);
}

export function FontFallbackProvider({ children, enabled }: PropsWithChildren<{ enabled: boolean }>) {
  return <FontFallbackContext.Provider value={enabled}>{children}</FontFallbackContext.Provider>;
}
