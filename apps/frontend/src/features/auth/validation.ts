export type LoginInput = {
  email: string;
  password: string;
};

export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O e-mail é comparado e enviado sem espaços externos. */
export function normalizeEmail(value: string): string {
  return value.trim();
}

/**
 * Regras locais do login: e-mail obrigatório com formato aparente e senha
 * apenas obrigatória. A senha nunca recebe trim, lowercase ou validação de
 * tamanho, para não divergir de contas existentes nem de futuras políticas.
 */
export function validateLogin(input: LoginInput): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const email = normalizeEmail(input.email);

  if (!email) {
    errors.email = 'Informe seu e-mail.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Informe um e-mail válido.';
  }

  if (!input.password) {
    errors.password = 'Informe sua senha.';
  }

  return errors;
}
