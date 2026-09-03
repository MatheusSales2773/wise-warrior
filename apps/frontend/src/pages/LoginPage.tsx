import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../features/auth/components/AuthShell';
import { PasswordField } from '../features/auth/components/PasswordField';
import { useAuth } from '../features/auth/AuthContext';

interface LoginFieldErrors {
  email?: string;
  password?: string;
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

function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Informe seu e-mail.';
  } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    errors.email = 'Use um e-mail válido.';
  }

  if (!password) {
    errors.password = 'Informe sua senha.';
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

export function LoginPage(): ReactNode {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setApiError(null);

    const validationErrors = validateLogin(email, password);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password, navigator.userAgent);
      navigate('/', { replace: true });
    } catch (error: unknown) {
      setApiError(
        getApiStatus(error) === 401
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="A fortaleza espera"
      title="Entre na batalha"
      description="Retome o fio da sua jornada e transforme cada minuto de concentração em progresso visível."
    >
      <form className="auth-form" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div>
          <h2 className="auth-form__intro">Abra seu grimório</h2>
          <p className="auth-form__subintro">Seus registros de foco aguardam por você.</p>
        </div>

        <div className={`auth-field${fieldErrors.email ? ' auth-field--invalid' : ''}`}>
          <div className="auth-field__label-row">
            <label htmlFor="login-email">E-mail</label>
            <span className="auth-field__hint">IDENTIDADE</span>
          </div>
          <input
            className="auth-input"
            id="login-email"
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
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          />
          {fieldErrors.email ? <FieldError id="login-email-error">{fieldErrors.email}</FieldError> : null}
        </div>

        <PasswordField
          id="login-password"
          name="password"
          label="Senha"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
            setApiError(null);
          }}
          error={fieldErrors.password}
        />

        <div className="auth-form__meta">
          <span className="auth-form__meta-mark" aria-hidden="true">✦</span>
          <span>Seu progresso permanece protegido no grimório</span>
        </div>

        {apiError ? (
          <div className="auth-alert" role="alert">
            <span className="auth-alert__mark" aria-hidden="true">!</span>
            <p>{apiError}</p>
          </div>
        ) : null}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          <span>{isSubmitting ? 'Abrindo o grimório…' : 'Entrar na batalha'}</span>
          <span className="auth-submit__arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        Ainda não tem um grimório? <Link to="/cadastro">Crie seu personagem</Link>
      </p>
    </AuthShell>
  );
}
