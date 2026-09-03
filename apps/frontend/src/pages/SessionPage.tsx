import { useState, type FormEvent } from 'react';
import { useStudySession } from '../features/sessions/useStudySession';

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SessionPage() {
  const { isRunning, elapsedSeconds, lastResult, start, stop } = useStudySession();
  const [subject, setSubject] = useState('');

  async function handleStart(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!subject.trim()) return;
    await start(subject.trim());
  }

  return (
    <section style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Sessão de Estudos</h1>

      {!isRunning && (
        <form onSubmit={handleStart} style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <input
            aria-label="Matéria"
            placeholder="Matéria (ex.: Matemática Discreta)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ minHeight: 'var(--touch-target-min)' }}
          />
          <button type="submit" style={{ minHeight: 'var(--touch-target-min)' }}>
            Iniciar Sessão
          </button>
        </form>
      )}

      {isRunning && (
        <>
          <p
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 10vw, 80px)',
              color: 'var(--color-primary)',
            }}
          >
            {formatElapsed(elapsedSeconds)}
          </p>
          <button onClick={() => void stop()} style={{ minHeight: 'var(--touch-target-min)' }}>
            Encerrar
          </button>
        </>
      )}

      {lastResult && (
        <p role="status">
          {lastResult.discardedReason
            ? 'Sessão não contabilizada (duração fora dos limites permitidos).'
            : `+${lastResult.xpAwarded} XP ganhos nesta sessão.`}
        </p>
      )}
    </section>
  );
}
