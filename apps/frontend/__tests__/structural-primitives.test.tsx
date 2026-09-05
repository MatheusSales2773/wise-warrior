import { act, render, screen } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WiseCard } from '@/design-system/components/WiseCard';
import { WiseIcon } from '@/design-system/icons/WiseIcon';
import { Screen } from '@/design-system/components/screen';
import { WiseText } from '@/design-system/components/WiseText';
import { screenGutter } from '@/design-system/tokens/layout';
import { theme } from '@/design-system/tokens/theme';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 800 },
  insets: { top: 24, right: 0, bottom: 34, left: 0 },
};
const longContent = 'Conteúdo longo da tela permanece acessível e rolável. '.repeat(100);

function renderWithSafeArea(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>,
  });
}

describe('WiseText', () => {
  it.each([
    ['display', theme.type.display],
    ['title', theme.type.title],
    ['subtitle', theme.type.subtitle],
    ['body', theme.type.body],
    ['label', theme.type.label],
    ['caption', theme.type.caption],
    ['mono', theme.type.mono],
  ] as const)('maps the %s role to its typography token', async (variant, typography) => {
    await render(
      <WiseText testID={`wise-text-${variant}`} variant={variant}>
        A long piece of text remains readable when the system font is enlarged.
      </WiseText>,
    );

    expect(StyleSheet.flatten(screen.getByTestId(`wise-text-${variant}`).props.style)).toMatchObject(typography);
  });

  it('uses semantic colors and keeps system font scaling enabled', async () => {
    await render(
      <WiseText testID="wise-text-body" color="textSecondary" variant="body" maxFontSizeMultiplier={2}>
        Texto ampliado
      </WiseText>,
    );

    const text = screen.getByTestId('wise-text-body');
    expect(StyleSheet.flatten(text.props.style).color).toBe(theme.color.textSecondary);
    expect(text.props.allowFontScaling).toBe(true);
    expect(text.props.maxFontSizeMultiplier).toBe(2);
  });

  it('does not allow a style to bypass the semantic text color', async () => {
    await render(
      <WiseText style={{ color: '#ffffff' } as never} color="textSecondary" variant="body">
        Cor semântica
      </WiseText>,
    );

    expect(StyleSheet.flatten(screen.getByText('Cor semântica').props.style).color).toBe(theme.color.textSecondary);
  });

  it('does not allow a style to bypass the variant typography', async () => {
    await render(
      <WiseText
        style={{ fontFamily: 'Courier', fontSize: 99, lineHeight: 101, letterSpacing: 8 } as never}
        variant="body"
      >
        Tipografia fixa
      </WiseText>,
    );

    expect(StyleSheet.flatten(screen.getByText('Tipografia fixa').props.style)).toMatchObject(theme.type.body);
  });

  it('rejects colors that are not semantic aliases', () => {
    expect(() => WiseText({ color: '#ffffff' as never, variant: 'body' })).toThrow(/semantic color/i);
  });
});

describe('WiseCard', () => {
  it('renders a default card as a non-interactive surface', async () => {
    await render(
      <WiseCard testID="wise-card" variant="default">
        <WiseText variant="body">Conteúdo do card</WiseText>
      </WiseCard>,
    );

    const card = screen.getByTestId('wise-card');
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: theme.color.surfaceCard,
      borderColor: theme.color.borderSoft,
      borderWidth: theme.border.standard,
    });
    expect(card.props.accessibilityRole).not.toBe('button');
    expect(card.props.onPress).toBeUndefined();
  });

  it('uses the elevated surface and card shadow', async () => {
    await render(
      <WiseCard testID="wise-card" variant="elevated">
        <WiseText variant="body">Conteúdo elevado</WiseText>
      </WiseCard>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('wise-card').props.style)).toMatchObject({
      backgroundColor: theme.color.surfaceElevated,
      ...theme.elevation.card,
    });
  });

  it('keeps the ornament decorative and outside the accessibility tree', async () => {
    await render(
      <WiseCard testID="wise-card" variant="ornamented">
        <WiseText variant="body">Conteúdo ornamentado</WiseText>
      </WiseCard>,
    );

    const ornament = screen.getByTestId('wise-card-ornament', { includeHiddenElements: true });
    expect(ornament.props.accessible).toBe(false);
    expect(ornament.props.importantForAccessibility).toBe('no');
    expect(screen.getByTestId('wise-card', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Screen', () => {
  it.each([
    ['web', 390, theme.layout.narrowWebGutter],
    ['web', 899, theme.layout.narrowWebGutter],
    ['web', 900, theme.layout.wideWebGutter],
    ['ios', 390, theme.layout.mobileGutter],
    ['android', 390, theme.layout.mobileGutter],
  ] as const)('uses the fixed %s gutter at %ddp', (platform, width, expectedGutter) => {
    expect(screenGutter(platform, width)).toBe(expectedGutter);
  });

  it('applies the narrow web gutter to the rendered screen content', async () => {
    const originalPlatform = Platform.OS;
    const originalWindow = Dimensions.get('window');
    const originalScreen = Dimensions.get('screen');

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    await act(() => {
      Dimensions.set({
        window: { ...originalWindow, width: 390 },
        screen: { ...originalScreen, width: 390 },
      });
    });

    try {
      await renderWithSafeArea(
        <Screen title="Viewport estreita">
          <WiseText variant="body">Conteúdo que cabe em uma janela estreita</WiseText>
        </Screen>,
      );

      expect(StyleSheet.flatten(screen.getByTestId('screen-content').props.style)).toMatchObject({
        paddingHorizontal: theme.layout.narrowWebGutter,
      });
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
      await act(() => {
        Dimensions.set({ window: originalWindow, screen: originalScreen });
      });
    }
  });

  it('renders a required heading and scrolls by default without duplicating inset handling', async () => {
    await renderWithSafeArea(
      <Screen title="Mapa inicial">
        <WiseText variant="body">{longContent}</WiseText>
      </Screen>,
    );

    expect(screen.getByRole('header', { name: 'Mapa inicial' })).toBeTruthy();
    expect(screen.getByText(longContent)).toBeTruthy();
    const scroll = screen.getByTestId('screen-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(scroll.props.contentContainerStyle).toEqual(expect.arrayContaining([expect.objectContaining({ flexGrow: 1 })]));

    expect(screen.getByTestId('screen-safe-area').props.edges).toEqual({ top: 'additive', right: 'additive', bottom: 'additive', left: 'additive' });
    expect(StyleSheet.flatten(screen.getByTestId('screen-content').props.style)).toMatchObject({
      width: '100%',
      maxWidth: theme.layout.contentMaxWidth,
    });
  });

  it('does not protect the bottom edge twice when bottom navigation owns it', async () => {
    await renderWithSafeArea(
      <Screen hasBottomNavigation title="Com navegação inferior">
        <WiseText variant="body">Conteúdo</WiseText>
      </Screen>,
    );

    expect(screen.getByTestId('screen-safe-area').props.edges).toEqual({ top: 'additive', right: 'additive', bottom: 'off', left: 'additive' });
  });

  it('supports long non-scrollable content when scrolling is explicitly disabled', async () => {
    await renderWithSafeArea(
      <Screen scrollable={false} title="Conteúdo fixo">
        <WiseText variant="body">{longContent}</WiseText>
      </Screen>,
    );

    expect(screen.getByText(longContent)).toBeTruthy();
    expect(screen.queryByTestId('screen-scroll')).toBeNull();
    expect(screen.getByTestId('screen-static-content')).toBeTruthy();
  });

  it('uses platform keyboard avoidance only when enabled', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    await renderWithSafeArea(
      <Screen avoidKeyboard title="iOS com teclado">
        <WiseText variant="body">Conteúdo</WiseText>
      </Screen>,
    );

    expect(screen.getByTestId('screen-keyboard-avoider')).toBeTruthy();
  });

  it('uses height avoidance on Android and no native shift on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    await renderWithSafeArea(
      <Screen avoidKeyboard title="Android com teclado">
        <WiseText variant="body">Conteúdo</WiseText>
      </Screen>,
    );
    expect(screen.getByTestId('screen-keyboard-avoider')).toBeTruthy();

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    await renderWithSafeArea(
      <Screen avoidKeyboard title="Web sem deslocamento">
        <WiseText variant="body">Conteúdo</WiseText>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-keyboard-avoider')).toBeNull();
  });
});

describe('WiseIcon', () => {
  it('uses a declared Ionicon, semantic color, and token size as decoration by default', async () => {
    await render(<WiseIcon color="accentPrimary" name="home-outline" testID="wise-icon" />);

    const icon = screen.getByTestId('wise-icon', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icon.props.style)).toMatchObject({ fontSize: theme.iconSize.medium, color: theme.color.accentPrimary });
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.importantForAccessibility).toBe('no');
  });

  it('exposes an informative icon only when it has an accessible label', async () => {
    await render(<WiseIcon accessibilityLabel="Abrir acampamento" name="home" />);

    const icon = screen.getByRole('image', { name: 'Abrir acampamento' });
    expect(icon.props.accessible).toBe(true);
    expect(icon.props.accessibilityRole).toBe('image');
  });

  it('rejects undeclared icon names and unlabeled informative icons', () => {
    expect(() => WiseIcon({ name: 'rocket' as never })).toThrow(/unsupported icon name/i);
    expect(() => WiseIcon({ decorative: false, name: 'home' })).toThrow(/accessible label/i);
    expect(() => WiseIcon({ name: 'home', size: 20 as never })).toThrow(/unsupported icon size/i);
  });

  it('keeps semantic icon color and token size when a style attempts to override them', async () => {
    await render(
      <WiseIcon
        color="accentPrimary"
        name="home-outline"
        style={{ color: '#ffffff', fontSize: 99 } as never}
        testID="wise-icon-safe-style"
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('wise-icon-safe-style', { includeHiddenElements: true }).props.style)).toMatchObject({
      color: theme.color.accentPrimary,
      fontSize: theme.iconSize.medium,
    });
  });
});
