import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, displayName);
      navigate('/');
    } catch {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Inicie sua jornada</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Nome</label>
        <input
          id="displayName"
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={{ minHeight: 'var(--touch-target-min)', width: '100%' }}
        />
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ minHeight: 'var(--touch-target-min)', width: '100%' }}
        />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ minHeight: 'var(--touch-target-min)', width: '100%' }}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} style={{ minHeight: 'var(--touch-target-min)' }}>
          {isSubmitting ? 'Criando…' : 'Criar personagem'}
        </button>
      </form>
      <p>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
