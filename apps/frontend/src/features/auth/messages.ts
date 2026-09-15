import { isApiError, type ApiErrorCategory } from '@/core/api/api-error';

const MESSAGES: Record<ApiErrorCategory, string> = {
  validation: 'Revise os campos destacados.',
  credentials: 'E-mail ou senha incorretos.',
  conflict: 'Este e-mail já está cadastrado.',
  session: 'Sua sessão expirou. Entre novamente.',
  network: 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.',
  server: 'O servidor está indisponível. Tente novamente em instantes.',
  storage: 'Não foi possível salvar a sessão neste dispositivo. Tente novamente.',
  cancelled: 'A solicitação foi cancelada. Tente novamente.',
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
  storage: 'Sua conta foi criada, mas não foi possível salvar a sessão neste dispositivo. Tente entrar novamente.',
  cancelled: 'A solicitação foi cancelada. Tente novamente.',
  unexpected: 'Não foi possível criar sua conta agora. Tente novamente.',
};

export function registerErrorMessage(error: unknown): string {
  if (isApiError(error)) return REGISTER_MESSAGES[error.category];
  return REGISTER_MESSAGES.unexpected;
}

const LOGOUT_MESSAGES: Record<ApiErrorCategory, string> = {
  validation: 'Não foi possível sair agora. Sua sessão continua ativa; tente novamente.',
  credentials: 'Não foi possível sair agora. Sua sessão continua ativa; tente novamente.',
  conflict: 'Não foi possível sair agora. Sua sessão continua ativa; tente novamente.',
  session: 'Não foi possível sair agora. Sua sessão continua ativa; tente novamente.',
  network: 'Não foi possível sair agora. Sua sessão continua ativa; verifique sua conexão e tente novamente.',
  server: 'Não foi possível sair agora. Sua sessão continua ativa; tente novamente em instantes.',
  storage: 'Não foi possível remover a sessão deste dispositivo. Sua sessão continua ativa; tente novamente.',
  cancelled: 'A solicitação foi cancelada. Sua sessão continua ativa; tente novamente.',
  unexpected: 'Não foi possível confirmar a saída. Sua sessão continua ativa; tente novamente.',
};

export function logoutErrorMessage(error: unknown): string {
  if (isApiError(error)) return LOGOUT_MESSAGES[error.category];
  return LOGOUT_MESSAGES.unexpected;
}
