import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    login: mocks.login,
    register: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

async function fillLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('E-mail'), 'warrior@example.com');
  await user.type(screen.getByLabelText('Senha'), 'runas-e-foco');
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.login.mockResolvedValue(undefined);
  });

  it('renderiza os campos, CTA e link para cadastro', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { name: 'Entre na batalha' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: /entrar na batalha/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /crie seu personagem/i })).toHaveAttribute('href', '/cadastro');
  });

  it('alterna a visibilidade da senha', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    const password = screen.getByLabelText('Senha');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument();
  });

  it('valida o formulário localmente antes de chamar a API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /entrar na batalha/i }));

    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
  });

  it('chama login uma vez com o user agent e redireciona após sucesso', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /entrar na batalha/i }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    expect(mocks.login).toHaveBeenCalledWith('warrior@example.com', 'runas-e-foco', navigator.userAgent);
    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('mostra mensagem específica para credenciais inválidas', async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue({ response: { status: 401 } });
    renderLoginPage();
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /entrar na batalha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('mostra mensagem genérica quando o serviço está indisponível', async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue(new Error('network unavailable'));
    renderLoginPage();
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /entrar na batalha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível entrar agora. Tente novamente.',
    );
  });

  it('desabilita o CTA enquanto a requisição está em andamento', async () => {
    const user = userEvent.setup();
    let resolveLogin: () => void = () => undefined;
    mocks.login.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    renderLoginPage();
    await fillLoginForm(user);

    const submit = screen.getByRole('button', { name: /entrar na batalha/i });
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('Abrindo o grimório');
    resolveLogin();
    await waitFor(() => expect(submit).not.toBeDisabled());
  });
});
