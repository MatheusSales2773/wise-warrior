import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { mockAuthState } from '../test-utils/auth-context';

jest.mock('@/core/auth/auth-context', () => require('../test-utils/auth-context').createAuthContextMock());

beforeEach(() => {
  mockAuthState.status = 'anonymous';
  mockAuthState.sessionId = null;
  mockAuthState.error = null;
  mockAuthState.retryRestore.mockClear();
});

describe('M3 Web route guards', () => {
  it('keeps anonymous users on /entrar without rendering the authenticated shell', async () => {
    const router = renderRouter('src/app', { initialUrl: '/entrar' });
    await router;

    await waitFor(() => expect(router).toHavePathname('/entrar'));
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.queryByTestId('web-sidebar')).toBeNull();
    expect(screen.queryByTestId('mobile-navigation')).toBeNull();
  });

  it.each(['/', '/perfil', '/guilda', '/sessao'])(
    'redirects anonymous deep link %s to /entrar',
    async (initialUrl) => {
      const router = renderRouter('src/app', { initialUrl });
      await router;
      await waitFor(() => expect(router).toHavePathname('/entrar'));
      expect(screen.getByLabelText('E-mail')).toBeTruthy();
    },
  );

  it('redirects authenticated users away from the public route into the shell', async () => {
    mockAuthState.status = 'authenticated';
    mockAuthState.sessionId = 'session-1';
    const router = renderRouter('src/app', { initialUrl: '/entrar' });
    await router;

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(screen.getByTestId('mobile-navigation')).toBeTruthy();
  });

  it('renders the shell for authenticated users on a protected route', async () => {
    mockAuthState.status = 'authenticated';
    mockAuthState.sessionId = 'session-1';
    const router = renderRouter('src/app', { initialUrl: '/guilda' });
    await router;

    await waitFor(() => expect(router).toHavePathname('/guilda'));
    expect(screen.getByTestId('mobile-navigation')).toBeTruthy();
  });

  it('shows the restoring gate without flashing login or shell', async () => {
    mockAuthState.status = 'restoring';
    const router = renderRouter('src/app', { initialUrl: '/' });
    await router;

    expect(screen.getByTestId('session-restoring-safe-area')).toBeTruthy();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(screen.queryByTestId('mobile-navigation')).toBeNull();
  });

  it('offers retry when session verification is unavailable', async () => {
    mockAuthState.status = 'unavailable';
    const router = renderRouter('src/app', { initialUrl: '/' });
    await router;

    expect(screen.getByTestId('session-unavailable-safe-area')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockAuthState.retryRestore).toHaveBeenCalledTimes(1);
  });
});
