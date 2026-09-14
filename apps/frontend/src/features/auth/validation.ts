export type LoginInput = {
  email: string;
  password: string;
};

export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export type RegistrationInput = {
  displayName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type RegistrationFieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
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

/** Remove apenas espaços externos dos campos que não são segredo. */
export function normalizeRegistration(input: RegistrationInput) {
  return {
    displayName: input.displayName.trim(),
    email: normalizeEmail(input.email),
    password: input.password,
  };
}

export function validateRegistration(input: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);

  if (!displayName) {
    errors.displayName = 'Informe seu nome de guerreiro.';
  } else if (displayName.length < 2 || displayName.length > 60) {
    errors.displayName = 'Use entre 2 e 60 caracteres.';
  }

  if (!email) {
    errors.email = 'Informe seu e-mail.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Informe um e-mail válido.';
  }

  if (!input.password) {
    errors.password = 'Informe sua senha.';
  } else if (input.password.length < 8 || input.password.length > 128) {
    errors.password = 'Use entre 8 e 128 caracteres.';
  }

  if (!input.passwordConfirmation) {
    errors.passwordConfirmation = 'Confirme sua senha.';
  } else if (input.passwordConfirmation !== input.password) {
    errors.passwordConfirmation = 'As senhas devem coincidir.';
  }

  return errors;
}
