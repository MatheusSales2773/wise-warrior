import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    register: mocks.register,
    login: vi.fn(),
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

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/cadastro']}>
      <RegisterPage />
    </MemoryRouter>,
  );
}

async function fillRegisterForm(user: ReturnType<typeof userEvent.setup>, password = 'runas-e-foco') {
  await user.type(screen.getByLabelText('Nome do guerreiro'), 'Ariane');
  await user.type(screen.getByLabelText('E-mail'), 'ariane@example.com');
  await user.type(screen.getByLabelText('Senha'), password);
  await user.type(screen.getByLabelText('Confirmar senha'), password);
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.register.mockResolvedValue(undefined);
  });

  it('renderiza os campos, CTA e link para login', () => {
    renderRegisterPage();

    expect(screen.getByRole('heading', { name: 'Inicie sua jornada' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do guerreiro')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirmar senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('button', { name: /criar personagem/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entre na fortaleza/i })).toHaveAttribute('href', '/entrar');
  });

  it('não submete quando as senhas divergem', async () => {
    const user = userEvent.setup();
    renderRegisterPage();
    await fillRegisterForm(user, 'runas-e-foco');
    await user.clear(screen.getByLabelText('Confirmar senha'));
    await user.type(screen.getByLabelText('Confirmar senha'), 'outra-senha');

    await user.click(screen.getByRole('button', { name: /criar personagem/i }));

    expect(mocks.register).not.toHaveBeenCalled();
    expect(screen.getByText('As senhas precisam ser iguais.')).toBeInTheDocument();
  });

  it('valida os limites de nome e senha antes da submissão', async () => {
    const user = userEvent.setup();
    renderRegisterPage();
    fireEvent.change(screen.getByLabelText('Nome do guerreiro'), { target: { value: 'A' } });
    await user.type(screen.getByLabelText('E-mail'), 'ariane@example.com');
    await user.type(screen.getByLabelText('Senha'), 'curta');
    await user.type(screen.getByLabelText('Confirmar senha'), 'curta');

    await user.click(screen.getByRole('button', { name: /criar personagem/i }));

    expect(mocks.register).not.toHaveBeenCalled();
    expect(screen.getByText('Use entre 2 e 60 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('Use entre 8 e 128 caracteres.')).toBeInTheDocument();
  });

  it('chama register sem enviar a confirmação e redireciona após sucesso', async () => {
    const user = userEvent.setup();
    renderRegisterPage();
    await fillRegisterForm(user);

    await user.click(screen.getByRole('button', { name: /criar personagem/i }));

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(mocks.register).toHaveBeenCalledWith('ariane@example.com', 'runas-e-foco', 'Ariane');
    expect(mocks.register.mock.calls[0]).toHaveLength(3);
    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('mostra mensagem específica quando o e-mail já está cadastrado', async () => {
    const user = userEvent.setup();
    mocks.register.mockRejectedValue({ response: { status: 409 } });
    renderRegisterPage();
    await fillRegisterForm(user);

    await user.click(screen.getByRole('button', { name: /criar personagem/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este e-mail já está cadastrado.');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('mostra orientação de revisão quando a API rejeita os dados', async () => {
    const user = userEvent.setup();
    mocks.register.mockRejectedValue({ response: { status: 400 } });
    renderRegisterPage();
    await fillRegisterForm(user);

    await user.click(screen.getByRole('button', { name: /criar personagem/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Revise os campos destacados.');
  });
});
