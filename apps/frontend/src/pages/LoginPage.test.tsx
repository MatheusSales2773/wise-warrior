import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../features/auth/AuthContext';

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    post: vi.fn().mockRejectedValue(new Error('no session to restore')),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock('../lib/socket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('renders the email and password fields with a submit button', async () => {
    renderLoginPage();

    expect(await screen.findByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar na batalha/i })).toBeInTheDocument();
  });

  it('requires both fields before allowing submission', async () => {
    renderLoginPage();
    const user = userEvent.setup();

    const emailInput = await screen.findByLabelText(/e-mail/i);
    expect(emailInput).toBeRequired();

    await user.type(emailInput, 'not-an-email');
    expect(emailInput).toHaveValue('not-an-email');
  });
});
