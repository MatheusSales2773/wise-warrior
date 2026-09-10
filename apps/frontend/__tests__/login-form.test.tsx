import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/core/api/api-error';
import { AuthProvider } from '@/core/auth/auth-context';
import type { AuthService } from '@/core/auth/auth-service';
import type { AuthSession, RestoreResult } from '@/core/auth/types';
import { LoginForm } from '@/features/auth/login-form';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function serviceDouble(login: () => Promise<AuthSession>): AuthService {
  return {
    login,
    restore: async (): Promise<RestoreResult> => ({ status: 'anonymous' }),
  };
}

async function renderLogin(service: AuthService) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider service={service}>
        <LoginForm />
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

describe('LoginForm', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the accessible fields, CTA and password toggle without the authenticated shell', async () => {
    await renderLogin(serviceDouble(async () => ({ sessionId: 's' })));

    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar na batalha' })).toBeTruthy();
    expect(screen.getByLabelText('Mostrar senha')).toBeTruthy();
    expect(screen.queryByTestId('web-sidebar')).toBeNull();
    expect(screen.queryByTestId('mobile-navigation')).toBeNull();
  });

  it('validates locally, focuses the first invalid field and never calls login', async () => {
    const login = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 's' }));
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderLogin(serviceDouble(login));

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na batalha' }));

    expect(screen.getByText('Informe seu e-mail.')).toBeTruthy();
    expect(screen.getByText('Informe sua senha.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('rejects an invalid e-mail before calling the API', async () => {
    const login = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 's' }));
    await renderLogin(serviceDouble(login));

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'guerreiro');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na batalha' }));

    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('toggles password visibility with an explicit pressed state', async () => {
    await renderLogin(serviceDouble(async () => ({ sessionId: 's' })));
    const password = screen.getByLabelText('Senha');
    expect(password.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByLabelText('Mostrar senha'));
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Ocultar senha').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('moves focus from the e-mail field with the keyboard and submits from the password field', async () => {
    const login = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-keyboard' }));
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderLogin(serviceDouble(login));

    const email = screen.getByLabelText('E-mail');
    await fireEvent(email, 'submitEditing');
    expect(focus).toHaveBeenCalled();

    await fireEvent.changeText(email, 'guerreiro@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo');
    await act(async () => {
      await fireEvent(screen.getByLabelText('Senha'), 'submitEditing');
    });

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith({ email: 'guerreiro@wise.app', password: 'segredo' });
  });

  it('trims the e-mail before sending and announces a credentials failure', async () => {
    const login = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('credentials', { status: 401 });
    });
    await renderLogin(serviceDouble(login));

    await fireEvent.changeText(screen.getByLabelText('E-mail'), '  guerreiro@wise.app ');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na batalha' }));

    await waitFor(() => expect(screen.getByText('E-mail ou senha incorretos.')).toBeTruthy());
    const alert = screen.getByRole('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    expect(alert.props['aria-live']).toBe('assertive');
    expect(login).toHaveBeenCalledWith({ email: 'guerreiro@wise.app', password: 'segredo' });
  });

  it('ignores duplicate submissions while a request is in flight', async () => {
    let resolveLogin: (session: AuthSession) => void = () => undefined;
    const login = jest.fn(
      () =>
        new Promise<AuthSession>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    await renderLogin(serviceDouble(login));

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'guerreiro@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo');
    const cta = screen.getByRole('button', { name: 'Entrar na batalha' });
    await fireEvent.press(cta);
    expect(screen.getByRole('button', { name: 'Entrar na batalha' }).props.accessibilityState).toMatchObject({ busy: true });
    await fireEvent.press(cta);

    expect(login).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveLogin({ sessionId: 'done' });
    });
  });
});
