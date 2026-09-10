import { ApiError } from '@/core/api/api-error';
import { loginErrorMessage } from '@/features/auth/messages';
import { normalizeEmail, validateLogin } from '@/features/auth/validation';

describe('login validation', () => {
  it('requires an e-mail and a password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Informe seu e-mail.',
      password: 'Informe sua senha.',
    });
    expect(validateLogin({ email: '   ', password: ' ' })).toEqual({
      email: 'Informe seu e-mail.',
    });
  });

  it('rejects an apparent invalid e-mail without touching the password', () => {
    expect(validateLogin({ email: 'guerreiro', password: 'segredo' })).toEqual({
      email: 'Informe um e-mail válido.',
    });
  });

  it('accepts a valid e-mail and never trims or rewrites the password', () => {
    expect(validateLogin({ email: 'guerreiro@wise.app', password: ' senha ' })).toEqual({});
    expect(normalizeEmail('  guerreiro@wise.app  ')).toBe('guerreiro@wise.app');
  });
});

describe('login error messages', () => {
  it('maps API categories to safe public copy', () => {
    expect(loginErrorMessage(new ApiError('credentials', { status: 401 }))).toBe('E-mail ou senha incorretos.');
    expect(loginErrorMessage(new ApiError('credentials', { status: 401, problemDetail: 'senha errada' }))).not.toContain('senha errada');
    expect(loginErrorMessage(new ApiError('network'))).toContain('conexão');
    expect(loginErrorMessage(new ApiError('server'))).toContain('servidor');
    expect(loginErrorMessage(new Error('boom'))).toBe('Não foi possível entrar agora. Tente novamente.');
  });
});
