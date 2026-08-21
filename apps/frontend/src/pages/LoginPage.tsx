import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, navigator.userAgent);
      navigate('/');
    } catch {
      setError('Credenciais inválidas.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Entre na batalha</h1>
      <form onSubmit={handleSubmit}>
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ minHeight: 'var(--touch-target-min)', width: '100%' }}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} style={{ minHeight: 'var(--touch-target-min)' }}>
          {isSubmitting ? 'Entrando…' : 'Entrar na batalha'}
        </button>
      </form>
      <p>
        Não tem conta? <Link to="/cadastro">Crie seu personagem</Link>
      </p>
    </div>
  );
}
