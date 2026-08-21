import { useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordField({ label, error, hint = 'SEGREDO', id = 'auth-password', ...inputProps }: PasswordFieldProps): ReactNode {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = `${id}-error`;
  const describedBy = [inputProps['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`auth-field${error ? ' auth-field--invalid' : ''}`}>
      <div className="auth-field__label-row">
        <label htmlFor={id}>{label}</label>
        <span className="auth-field__hint">{hint}</span>
      </div>
      <div className="auth-password-input">
        <input
          {...inputProps}
          id={id}
          className="auth-input auth-input--password"
          type={isVisible ? 'text' : 'password'}
          aria-invalid={error ? true : inputProps['aria-invalid']}
          aria-describedby={describedBy}
        />
        <button
          className="auth-password-input__toggle"
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? `Ocultar ${label.toLocaleLowerCase()}` : `Mostrar ${label.toLocaleLowerCase()}`}
          aria-pressed={isVisible}
          aria-controls={id}
        >
          <span aria-hidden="true">{isVisible ? '◉' : '◌'}</span>
          <span className="auth-password-input__toggle-text">{isVisible ? 'Ocultar' : 'Mostrar'}</span>
        </button>
      </div>
      {error ? (
        <p className="auth-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
