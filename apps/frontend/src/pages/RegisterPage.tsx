import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../features/auth/components/AuthShell';
import { PasswordField } from '../features/auth/components/PasswordField';
import { useAuth } from '../features/auth/AuthContext';

interface RegisterFieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function getApiStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) {
    return undefined;
  }

  return typeof response.status === 'number' ? response.status : undefined;
}

function validateRegister(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const normalizedName = displayName.trim();
  const normalizedEmail = email.trim();

  if (!normalizedName) {
    errors.displayName = 'Informe seu nome.';
  } else if (normalizedName.length < 2 || normalizedName.length > 60) {
    errors.displayName = 'Use entre 2 e 60 caracteres.';
  }

  if (!normalizedEmail) {
    errors.email = 'Informe seu e-mail.';
  } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    errors.email = 'Use um e-mail válido.';
  }

  if (!password) {
    errors.password = 'Informe sua senha.';
  } else if (password.length < 8 || password.length > 128) {
    errors.password = 'Use entre 8 e 128 caracteres.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirme sua senha.';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'As senhas precisam ser iguais.';
  }

  return errors;
}

function FieldError({ id, children }: { id: string; children: ReactNode }): ReactNode {
  return (
    <p className="auth-field__error" id={id}>
      {children}
    </p>
  );
}

export function RegisterPage(): ReactNode {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setApiError(null);

    const validationErrors = validateRegister(displayName, email, password, confirmPassword);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim());
      navigate('/', { replace: true });
    } catch (error: unknown) {
      const status = getApiStatus(error);
      setApiError(
        status === 409
          ? 'Este e-mail já está cadastrado.'
          : status === 400
            ? 'Revise os campos destacados.'
            : 'Não foi possível criar sua conta agora. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="O primeiro capítulo"
      title="Inicie sua jornada"
      description="Escolha seu nome, erga sua guarda e comece a construir uma rotina digna de lenda."
    >
      <form className="auth-form" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div>
          <h2 className="auth-form__intro">Forje seu personagem</h2>
          <p className="auth-form__subintro">Um novo caminho começa com uma decisão.</p>
        </div>

        <div className={`auth-field${fieldErrors.displayName ? ' auth-field--invalid' : ''}`}>
          <div className="auth-field__label-row">
            <label htmlFor="register-display-name">Nome do guerreiro</label>
            <span className="auth-field__hint">2—60 LETRAS</span>
          </div>
          <input
            className="auth-input"
            id="register-display-name"
            name="displayName"
            type="text"
            required
            autoComplete="name"
            minLength={2}
            maxLength={60}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFieldErrors((current) => ({ ...current, displayName: undefined }));
              setApiError(null);
            }}
            aria-invalid={fieldErrors.displayName ? true : undefined}
            aria-describedby={fieldErrors.displayName ? 'register-display-name-error' : undefined}
          />
          {fieldErrors.displayName ? (
            <FieldError id="register-display-name-error">{fieldErrors.displayName}</FieldError>
          ) : null}
        </div>

        <div className={`auth-field${fieldErrors.email ? ' auth-field--invalid' : ''}`}>
          <div className="auth-field__label-row">
            <label htmlFor="register-email">E-mail</label>
            <span className="auth-field__hint">IDENTIDADE</span>
          </div>
          <input
            className="auth-input"
            id="register-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
              setApiError(null);
            }}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
          />
          {fieldErrors.email ? <FieldError id="register-email-error">{fieldErrors.email}</FieldError> : null}
        </div>

        <PasswordField
          id="register-password"
          name="password"
          label="Senha"
          required
          hint="8—128 RUNAS"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }));
            setApiError(null);
          }}
          error={fieldErrors.password}
        />

        <PasswordField
          id="register-confirm-password"
          name="confirmPassword"
          label="Confirmar senha"
          required
          hint="REPETIR"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            setApiError(null);
          }}
          error={fieldErrors.confirmPassword}
        />

        <div className="auth-form__meta">
          <span className="auth-form__meta-mark" aria-hidden="true">✦</span>
          <span>A confirmação fica apenas neste ritual</span>
        </div>

        {apiError ? (
          <div className="auth-alert" role="alert">
            <span className="auth-alert__mark" aria-hidden="true">!</span>
            <p>{apiError}</p>
          </div>
        ) : null}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          <span>{isSubmitting ? 'Forjando personagem…' : 'Criar personagem'}</span>
          <span className="auth-submit__arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        Já possui um grimório? <Link to="/entrar">Entre na fortaleza</Link>
      </p>
    </AuthShell>
  );
}
