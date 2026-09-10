import { isApiError, type ApiErrorCategory } from '@/core/api/api-error';

const MESSAGES: Record<ApiErrorCategory, string> = {
  validation: 'Revise os campos destacados.',
  credentials: 'E-mail ou senha incorretos.',
  conflict: 'Este e-mail já está cadastrado.',
  session: 'Sua sessão expirou. Entre novamente.',
  network: 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.',
  server: 'O servidor está indisponível. Tente novamente em instantes.',
  unexpected: 'Não foi possível entrar agora. Tente novamente.',
};

/** A UI controla o texto público; nunca exibimos o `detail` do backend. */
export function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) return MESSAGES[error.category];
  return MESSAGES.unexpected;
}
