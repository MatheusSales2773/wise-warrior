import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface SessionSummary {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  lastUsedAt: string;
}

/** Tela de "dispositivos logados" — UI direta do ADR-009 (sessão multi-dispositivo). */
export function ProfilePage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSessions(): Promise<void> {
    try {
      const response = await apiClient.get<SessionSummary[]>('/users/me/sessions');
      setSessions(response.data);
    } catch {
      setError('Não foi possível carregar seus dispositivos logados.');
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function revoke(sessionId: string): Promise<void> {
    await apiClient.delete(`/users/me/sessions/${sessionId}`);
    await loadSessions();
  }

  async function revokeAll(): Promise<void> {
    await apiClient.delete('/users/me/sessions');
    await loadSessions();
  }

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Perfil</h1>

      <h2>Dispositivos conectados</h2>
      {error && <p role="alert">{error}</p>}
      {!sessions && !error && <p role="status">Carregando…</p>}
      {sessions && sessions.length === 0 && <p>Nenhum outro dispositivo ativo.</p>}
      {sessions && sessions.length > 0 && (
        <ul>
          {sessions.map((session) => (
            <li key={session.id} style={{ marginBottom: 'var(--space-2)' }}>
              {session.deviceLabel ?? session.userAgent ?? 'Dispositivo desconhecido'} — último
              uso: {new Date(session.lastUsedAt).toLocaleString('pt-BR')}
              <button
                onClick={() => void revoke(session.id)}
                style={{ marginLeft: 'var(--space-2)', minHeight: 'var(--touch-target-min)' }}
              >
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      )}
      {sessions && sessions.length > 1 && (
        <button onClick={() => void revokeAll()} style={{ minHeight: 'var(--touch-target-min)' }}>
          Sair de todos os dispositivos
        </button>
      )}
    </section>
  );
}
