import { useState, type FormEvent } from 'react';
import { apiClient } from '../lib/apiClient';

interface Guild {
  id: string;
  name: string;
  level: number;
  memberCount: number;
}

export function GuildPage() {
  const [name, setName] = useState('');
  const [guild, setGuild] = useState<Guild | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const response = await apiClient.post<Guild>('/guilds', { name });
      setGuild(response.data);
    } catch {
      setError('Não foi possível criar a guilda — o nome já pode estar em uso.');
    }
  }

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Guilda</h1>

      {!guild && (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            aria-label="Nome da guilda"
            placeholder="Nome da guilda"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ minHeight: 'var(--touch-target-min)' }}
          />
          <button type="submit" style={{ minHeight: 'var(--touch-target-min)' }}>
            Criar guilda
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {guild && (
        <p>
          <strong>{guild.name}</strong> — nível {guild.level} · {guild.memberCount} membro(s)
        </p>
      )}
    </section>
  );
}
