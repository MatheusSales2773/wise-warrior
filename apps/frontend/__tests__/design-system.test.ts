import { isDesktopLayout } from '@/design-system/tokens/layout';
import { motionDuration, theme, typographyFor } from '@/design-system/tokens/theme';

describe('Ouro/Indigo public design system', () => {
  it('exposes the fixed semantic color palette', () => {
    expect(Object.values(theme.color)).toEqual([
      '#07070c',
      '#0c0c14',
      '#12121c',
      '#181826',
      '#1f1f2e',
      '#1f1f2e',
      '#0a0a12',
      'rgba(212, 168, 90, 0.08)',
      'rgba(212, 168, 90, 0.16)',
      'rgba(212, 168, 90, 0.16)',
      'rgba(212, 168, 90, 0.28)',
      'rgba(212, 168, 90, 0.45)',
      '#d4a85a',
      '#f0c97a',
      '#8a6a3a',
      'rgba(212, 168, 90, 0.35)',
      '#c44545',
      '#5b7fc4',
      '#4ea672',
      '#d65a8a',
      '#8a5bc4',
      '#f3ead4',
      '#b3a98e',
      '#6b6555',
      '#46412f',
    ]);
  });

  it('exposes the fixed spacing, radius, border, motion and layout scales', () => {
    expect(Object.values(theme.space)).toEqual([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(Object.values(theme.radius)).toEqual([3, 5, 8, 12, 999]);
    expect(theme.border).toEqual({ standard: 1, focus: 2 });
    expect(theme.motion).toEqual({ none: 0, quick: 120, standard: 180, deliberate: 240 });
    expect(theme.layout).toEqual({
      touchTarget: 44,
      sidebarWidth: 248,
      desktopBreakpoint: 900,
      contentMaxWidth: 1200,
      mobileGutter: 16,
      narrowWebGutter: 24,
      wideWebGutter: 32,
    });
  });

  it('exposes every fixed typography size and line height', () => {
    expect(Object.fromEntries(Object.entries(theme.type).map(([name, value]) => [name, [value.fontSize, value.lineHeight]]))).toEqual({
      display: [32, 40],
      title: [24, 32],
      subtitle: [18, 26],
      subtitleStrong: [18, 26],
      body: [16, 24],
      label: [14, 20],
      caption: [12, 16],
      mono: [14, 20],
      monoEmphasis: [14, 20],
    });
  });

  it('maps missing custom fonts to the defined family fallbacks', () => {
    expect(typographyFor('display', true).fontFamily).toBe('serif');
    expect(typographyFor('body', true).fontFamily).toBeUndefined();
    expect(typographyFor('mono', true).fontFamily).toBe('monospace');
  });

  it('removes non-essential duration when reduced motion is active', () => {
    expect(motionDuration(theme.motion.deliberate, true)).toBe(0);
    expect(motionDuration(theme.motion.deliberate, false)).toBe(240);
  });

  it.each([
    ['web', 899, false],
    ['web', 900, true],
    ['ios', 1200, false],
    ['android', 1200, false],
  ] as const)('classifies %s at %dpx as desktop=%s', (platform, width, expected) => {
    expect(isDesktopLayout(platform, width)).toBe(expected);
  });
});
