import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/core/api/api-error';
import { AuthProvider } from '@/core/auth/auth-context';
import type { AuthService } from '@/core/auth/auth-service';
import type { AuthSession, RestoreResult } from '@/core/auth/types';
import { RegisterForm } from '@/features/auth/register-form';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function serviceDouble(register: () => Promise<AuthSession>): AuthService {
  return {
    login: async () => ({ sessionId: 'session-login' }),
    register,
    restore: async (): Promise<RestoreResult> => ({ status: 'anonymous' }),
  };
}

function renderRegister(service: AuthService, initialMetrics = metrics) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <AuthProvider service={service}>
        <RegisterForm />
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

describe('RegisterForm', () => {
  it('renders the accessible registration fields, CTA and login link', async () => {
    await renderRegister(serviceDouble(async () => ({ sessionId: 'session-register' })));

    expect(screen.getByLabelText('Nome do guerreiro')).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByLabelText('Confirmar senha')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Crie seu personagem' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar personagem' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Já tem uma conta? Entre na batalha' })).toBeTruthy();
  });

  it('keeps the registration composition available inside a compact safe area', async () => {
    const rendered = await renderRegister(
      serviceDouble(async () => ({ sessionId: 'session-register' })),
      {
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 24, left: 0, right: 0, bottom: 34 },
      },
    );

    expect(rendered.getByLabelText('Nome do guerreiro')).toBeTruthy();
    expect(rendered.getByLabelText('Confirmar senha')).toBeTruthy();
    expect(rendered.getByRole('button', { name: 'Criar personagem' })).toBeTruthy();
    expect(rendered.getByRole('link', { name: 'Já tem uma conta? Entre na batalha' })).toBeTruthy();
    const root = rendered.root;
    if (!root) throw new Error('Registration shell did not render a root host element');
    const scroll = root.queryAll(
      (instance) => instance.props.keyboardShouldPersistTaps === 'handled',
    )[0];
    const safeArea = root.queryAll(
      (instance) => instance.type === 'RNCSafeAreaView',
    )[0];
    if (!safeArea || !scroll) throw new Error('Registration shell lost its safe-area or scroll container');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
  });

  it('validates locally, focuses the first invalid field and never calls register', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-register' }));
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderRegister(serviceDouble(register));

    await fireEvent.press(screen.getByRole('button', { name: 'Criar personagem' }));

    await waitFor(() => expect(screen.getByText('Informe seu nome de guerreiro.')).toBeTruthy());
    expect(screen.getByText('Informe seu e-mail.')).toBeTruthy();
    expect(screen.getByText('Informe sua senha.')).toBeTruthy();
    expect(screen.getByText('Confirme sua senha.')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
    focus.mockRestore();
  });

  it('normalizes public fields and never sends the confirmation value to the auth service', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-register' }));
    await renderRegister(serviceDouble(register));

    await fireEvent.changeText(screen.getByLabelText('Nome do guerreiro'), '  Aria  ');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), '  aria@wise.app ');
    await fireEvent.changeText(screen.getByLabelText('Senha'), '  secret123  ');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), '  secret123  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar personagem' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      displayName: 'Aria',
      email: 'aria@wise.app',
      password: '  secret123  ',
    });
  });

  it('announces a distinct e-mail conflict without exposing backend details', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('conflict', { status: 409, problemDetail: 'duplicate database key' });
    });
    await renderRegister(serviceDouble(register));

    await fireEvent.changeText(screen.getByLabelText('Nome do guerreiro'), 'Aria');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'aria@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'secret123');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar personagem' }));

    await waitFor(() => expect(screen.getByText('Este e-mail já está cadastrado.')).toBeTruthy());
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('duplicate database key')).toBeNull();
  });

  it('keeps the entered values and announces a retryable network failure', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('network');
    });
    await renderRegister(serviceDouble(register));

    await fireEvent.changeText(screen.getByLabelText('Nome do guerreiro'), 'Aria');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'aria@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'secret123');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar personagem' }));

    await waitFor(() => expect(screen.getByText(/não foi possível criar sua conta agora/i)).toBeTruthy());
    expect(screen.getByLabelText('Nome do guerreiro').props.value).toBe('Aria');
    expect(screen.getByLabelText('E-mail').props.value).toBe('aria@wise.app');
    expect(screen.getByLabelText('Senha').props.value).toBe('secret123');
  });

  it('announces when the account exists but the device cannot save its session', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => {
      throw new ApiError('storage');
    });
    await renderRegister(serviceDouble(register));

    await fireEvent.changeText(screen.getByLabelText('Nome do guerreiro'), 'Aria');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'aria@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'secret123');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar personagem' }));

    await waitFor(() => expect(screen.getByText(/conta foi criada/i)).toBeTruthy());
    expect(screen.getByText(/salvar a sessão neste dispositivo/i)).toBeTruthy();
  });

  it('moves through the fields with the keyboard and submits from the confirmation field', async () => {
    const register = jest.fn(async (): Promise<AuthSession> => ({ sessionId: 'session-register' }));
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderRegister(serviceDouble(register));

    const name = screen.getByLabelText('Nome do guerreiro');
    await fireEvent(name, 'submitEditing');
    expect(focus).toHaveBeenCalled();

    await fireEvent.changeText(name, 'Aria');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'aria@wise.app');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'secret123');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'secret123');
    await fireEvent(screen.getByLabelText('Confirmar senha'), 'submitEditing');

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    focus.mockRestore();
  });

  it('keeps password fields masked, exposes autofill hints and ignores duplicate submissions', async () => {
    let resolveRegister: (session: AuthSession) => void = () => undefined;
    const register = jest.fn(
      () => new Promise<AuthSession>((resolve) => {
        resolveRegister = resolve;
      }),
    );
    await renderRegister(serviceDouble(register));

    const name = screen.getByLabelText('Nome do guerreiro');
    const email = screen.getByLabelText('E-mail');
    const password = screen.getByLabelText('Senha');
    const confirmation = screen.getByLabelText('Confirmar senha');
    expect(name.props.maxLength).toBe(60);
    expect(email.props.autoComplete).toBe('email');
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.secureTextEntry).toBe(true);
    expect(confirmation.props.secureTextEntry).toBe(true);

    await fireEvent.changeText(name, 'Aria');
    await fireEvent.changeText(email, 'aria@wise.app');
    await fireEvent.changeText(password, 'secret123');
    await fireEvent.changeText(confirmation, 'secret123');
    const cta = screen.getByRole('button', { name: 'Criar personagem' });
    await fireEvent.press(cta);
    await fireEvent.press(cta);

    expect(register).toHaveBeenCalledTimes(1);
    expect(cta.props.accessibilityState).toMatchObject({ busy: true });
    expect(name.props.editable).toBe(false);

    await act(async () => {
      resolveRegister({ sessionId: 'session-register' });
    });
  });
});
