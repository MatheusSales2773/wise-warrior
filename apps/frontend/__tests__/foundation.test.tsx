import { render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import HomeScreen from '../src/app/index';

describe('Expo foundation routes', () => {
  it('renders the initial route copy through its public component', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Wise Warrior')).toBeTruthy();
    expect(screen.getByText('Fundação universal ativa')).toBeTruthy();
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

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }));

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(screen.getByText('Wise Warrior')).toBeTruthy();
  });
});
