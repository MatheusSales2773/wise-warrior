/**
 * Breakpoints mobile-first (ADR-008, PRD seção 13). Mantidos em sincronia
 * manual com `src/layouts/app-shell.css` — não há build step de design
 * tokens nesta fase, então qualquer alteração precisa dos dois lugares.
 */
export const BREAKPOINTS = {
  mobileMax: 639,
  tabletMax: 1023,
} as const;

export function isDesktopViewport(width: number): boolean {
  return width > BREAKPOINTS.tabletMax;
}
