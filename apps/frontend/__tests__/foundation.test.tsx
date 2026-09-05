import { render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import HomeScreen from '../src/app/index';
import { theme } from '../src/design-system/tokens/theme';

describe('Expo foundation routes', () => {
  it('renders the initial route copy through its public component', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Wise Warrior')).toBeTruthy();
    expect(screen.getByText('Fundação universal ativa')).toBeTruthy();

    const titleStyle = StyleSheet.flatten(screen.getByText('Wise Warrior').props.style);
    expect(titleStyle).toMatchObject({
      color: theme.color.textPrimary,
      fontFamily: theme.type.display.fontFamily,
      fontSize: theme.type.display.fontSize,
      lineHeight: theme.type.display.lineHeight,
    });
    expect(StyleSheet.flatten(screen.getByText('FUNDAÇÃO UNIVERSAL').props.style).fontFamily).toBe('Inter-Medium');
    expect(StyleSheet.flatten(screen.getByText('Fundação universal ativa').props.style).fontFamily).toBe('Cinzel-SemiBold');
    expect(StyleSheet.flatten(screen.getByText('OURO · ÍNDIGO').props.style).fontFamily).toBe('JetBrainsMono-Medium');
  });

  it('resolves the root pathname to the initial route', async () => {
    const router = renderRouter('src/app', { initialUrl: '/' });
    await router;

    expect(router).toHavePathname('/');
    expect(screen.getByText('Wise Warrior')).toBeTruthy();
  });

  it('renders the not-found route and navigates back to root', async () => {
    const router = renderRouter('src/app', { initialUrl: '/runa-inexistente' });
    await router;

    expect(router).toHavePathname('/runa-inexistente');
    expect(screen.getByText('Página não encontrada')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('RUNA 404').props.style).fontFamily).toBe('JetBrainsMono-Medium');
    expect(StyleSheet.flatten(screen.getByText('Página não encontrada').props.style).fontFamily).toBe('Cinzel-Bold');
    expect(StyleSheet.flatten(screen.getByText('Este caminho não pertence ao mapa.').props.style).fontFamily).toBe('Inter-Regular');
    expect(StyleSheet.flatten(screen.getByText('Voltar ao início').props.style).fontFamily).toBe('Inter-SemiBold');

    const buttonStyle = StyleSheet.flatten(screen.getByRole('button', { name: 'Voltar ao início' }).props.style);
    expect(buttonStyle.minHeight).toBe(theme.layout.touchTarget);
    expect(buttonStyle.minWidth).toBe(theme.layout.touchTarget);

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }));

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(screen.getByText('Wise Warrior')).toBeTruthy();
  });
});
