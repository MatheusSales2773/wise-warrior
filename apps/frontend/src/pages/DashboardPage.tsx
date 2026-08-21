import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface Profile {
  displayName: string;
  level: number;
  xpTotal: number;
  planTier: string;
}

export function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Profile>('/users/me')
      .then((response) => {
        if (!cancelled) setProfile(response.data);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar seu perfil.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!profile) return <p role="status">Carregando…</p>;

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Bem-vindo(a), {profile.displayName}</h1>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
        Nível {profile.level} · {profile.xpTotal} XP
      </p>
    </section>
  );
}
