import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../auth-pages.css';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

function WarriorSigil(): ReactNode {
  return (
    <svg
      className="auth-sigil"
      viewBox="0 0 120 120"
      role="img"
      aria-label="Sigilo do Wise"
    >
      <path
        d="M60 8 103 33v54l-43 25L17 87V33L60 8Z"
        fill="rgba(212,168,90,0.06)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M60 20 93 39v42L60 100 27 81V39L60 20Z"
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 6"
        strokeOpacity="0.65"
      />
      <path d="M60 32v57M42 74l18 15 18-15M42 48h36" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="48" r="3" fill="currentColor" />
    </svg>
  );
}

function CornerOrnaments(): ReactNode {
  return (
    <>
      <span className="auth-card__corner auth-card__corner--top-left" aria-hidden="true" />
      <span className="auth-card__corner auth-card__corner--top-right" aria-hidden="true" />
      <span className="auth-card__corner auth-card__corner--bottom-left" aria-hidden="true" />
      <span className="auth-card__corner auth-card__corner--bottom-right" aria-hidden="true" />
    </>
  );
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps): ReactNode {
  return (
    <main className="auth-page">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <Link className="auth-brand" to="/entrar" aria-label="Wise, ir para entrar">
            <span className="auth-brand__mark" aria-hidden="true">
              <WarriorSigil />
            </span>
            <span className="auth-brand__name">
              <span>Wise</span>
            </span>
          </Link>

          <div className="auth-story__copy">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1 id="auth-story-title">{title}</h1>
            <p className="auth-story__description">{description}</p>
          </div>

          <div className="auth-story__quote">
            <span className="auth-story__quote-mark" aria-hidden="true">
              “
            </span>
            <p>O foco não é encontrado. É forjado, uma sessão de cada vez.</p>
            <span className="auth-story__quote-rule" aria-hidden="true" />
            <span className="auth-story__quote-meta">CÓDICE DO GUERREIRO · I</span>
          </div>

          <div className="auth-story__footer" aria-hidden="true">
            <span className="auth-story__footer-line" />
            <span>FORJE SEU FOCO</span>
            <span className="auth-story__footer-line" />
          </div>
        </section>

        <section className="auth-form-panel" aria-label="Formulário de autenticação">
          <div className="auth-card">
            <CornerOrnaments />
            <div className="auth-card__header" aria-hidden="true">
              <span className="auth-card__rune">✦</span>
              <span className="auth-card__header-line" />
              <span className="auth-card__header-label">ACESSO À FORTALEZA</span>
              <span className="auth-card__header-line" />
              <span className="auth-card__rune">✦</span>
            </div>
            {children}
            <div className="auth-card__seal" aria-hidden="true">
              <span className="auth-card__seal-line" />
              <span>SEU PROGRESSO, SEU LEGADO</span>
              <span className="auth-card__seal-line" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
