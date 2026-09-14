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

const REGISTER_MESSAGES: Record<ApiErrorCategory, string> = {
  validation: 'Revise os campos destacados.',
  credentials: 'Não foi possível criar sua conta com esses dados.',
  conflict: 'Este e-mail já está cadastrado.',
  session: 'Não foi possível iniciar sua sessão. Tente novamente.',
  network: 'Não foi possível criar sua conta agora. Verifique sua conexão e tente novamente.',
  server: 'O servidor está indisponível. Tente novamente em instantes.',
  unexpected: 'Não foi possível criar sua conta agora. Tente novamente.',
};

export function registerErrorMessage(error: unknown): string {
  if (isApiError(error)) return REGISTER_MESSAGES[error.category];
  return REGISTER_MESSAGES.unexpected;
}
