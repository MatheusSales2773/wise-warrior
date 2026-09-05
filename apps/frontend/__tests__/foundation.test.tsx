import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { theme } from '../src/design-system/tokens/theme';

describe('Expo foundation routes', () => {
  it.each([
    ['/', 'Acampamento', 'Seu painel de progresso está em preparação.'],
    ['/sessao', 'Forja', 'Sua sessão de estudo está em preparação.'],
    ['/perfil', 'Personagem', 'Seu perfil está em preparação.'],
    ['/guilda', 'Guilda', 'Sua guilda está em preparação.'],
  ])('resolves %s directly with its honest placeholder', async (pathname, title, message) => {
    const router = renderRouter('src/app', { initialUrl: pathname });
    await router;

    expect(router).toHavePathname(pathname);
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
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
    expect(screen.getByRole('header', { name: 'Acampamento' })).toBeTruthy();
  });
});
