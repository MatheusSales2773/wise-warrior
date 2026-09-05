import { isDesktopLayout } from '@/design-system/tokens/layout';
import { motionDuration, theme, typographyFor } from '@/design-system/tokens/theme';

function relativeLuminance(color: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) throw new Error(`Contrast audit requires an opaque hexadecimal color, received ${color}.`);

  const channels = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const weights = [0.2126, 0.7152, 0.0722] as const;
  return channels.reduce((luminance, channel, index) => luminance + (channel * (weights[index] ?? 0)), 0);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const textContrastPairs = [
  { context: 'primary text on the screen canvas', foreground: theme.color.textPrimary, background: theme.color.backgroundCanvas },
  { context: 'primary text on the raised navigation surface', foreground: theme.color.textPrimary, background: theme.color.backgroundRaised },
  { context: 'primary text on the screen overlay gradient', foreground: theme.color.textPrimary, background: theme.color.backgroundOverlay },
  { context: 'primary text on cards and pills', foreground: theme.color.textPrimary, background: theme.color.surfaceCard },
  { context: 'primary text on elevated and interacting surfaces', foreground: theme.color.textPrimary, background: theme.color.surfaceElevated },
  { context: 'primary text in fields, feedback and danger buttons', foreground: theme.color.textPrimary, background: theme.color.surfaceInset },
  { context: 'secondary placeholder text on the screen canvas', foreground: theme.color.textSecondary, background: theme.color.backgroundCanvas },
  { context: 'secondary navigation and future-destination labels', foreground: theme.color.textSecondary, background: theme.color.backgroundRaised },
  { context: 'secondary placeholder text on the screen overlay gradient', foreground: theme.color.textSecondary, background: theme.color.backgroundOverlay },
  { context: 'secondary text on cards and interacting navigation', foreground: theme.color.textSecondary, background: theme.color.surfaceCard },
  { context: 'secondary field placeholder and disabled-button text', foreground: theme.color.textSecondary, background: theme.color.surfaceInset },
  { context: 'gold ghost-button text on the screen canvas', foreground: theme.color.accentPrimary, background: theme.color.backgroundCanvas },
  { context: 'gold future-destination badge on raised navigation', foreground: theme.color.accentPrimary, background: theme.color.backgroundRaised },
  { context: 'gold RUNA 404 text on its card', foreground: theme.color.accentPrimary, background: theme.color.surfaceCard },
  { context: 'gold ghost-button text on an interacting surface', foreground: theme.color.accentPrimary, background: theme.color.surfaceElevated },
  { context: 'highlighted brand and controls on raised navigation', foreground: theme.color.accentHighlight, background: theme.color.backgroundRaised },
  { context: 'highlighted mobile control on an interacting surface', foreground: theme.color.accentHighlight, background: theme.color.surfaceCard },
  { context: 'highlighted active navigation on an elevated surface', foreground: theme.color.accentHighlight, background: theme.color.surfaceElevated },
  { context: 'highlighted 404 action on its inset surface', foreground: theme.color.accentHighlight, background: theme.color.surfaceInset },
  { context: 'primary-button text on gold', foreground: theme.color.backgroundCanvas, background: theme.color.accentPrimary },
  { context: 'active primary-button text on highlighted gold', foreground: theme.color.backgroundCanvas, background: theme.color.accentHighlight },
] as const;

const graphicalContrastPairs = [
  { context: 'Web focus indicator beside raised navigation', foreground: theme.color.accentPrimary, background: theme.color.backgroundRaised },
  { context: 'Web focus indicator beside an elevated surface', foreground: theme.color.accentPrimary, background: theme.color.surfaceElevated },
  { context: 'focused input border on its inset surface', foreground: theme.color.accentPrimary, background: theme.color.surfaceInset },
  { context: 'determinate progress fill on its track', foreground: theme.color.accentPrimary, background: theme.color.surfaceCard },
  { context: 'danger and error border on an inset surface', foreground: theme.color.feedbackDanger, background: theme.color.surfaceInset },
  { context: 'informational feedback border on an inset surface', foreground: theme.color.feedbackInfo, background: theme.color.surfaceInset },
  { context: 'success feedback border on an inset surface', foreground: theme.color.feedbackSuccess, background: theme.color.surfaceInset },
  { context: 'warning feedback border on an inset surface', foreground: theme.color.accentPrimary, background: theme.color.surfaceInset },
  { context: 'inactive navigation icon on raised navigation', foreground: theme.color.textTertiary, background: theme.color.backgroundRaised },
  { context: 'inactive navigation icon on an interacting surface', foreground: theme.color.textTertiary, background: theme.color.surfaceCard },
] as const;

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
      bottomNavigationHeight: 80,
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

  it.each(textContrastPairs)('$context passes WCAG AA text contrast', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(graphicalContrastPairs)('$context passes WCAG non-text contrast', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
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
