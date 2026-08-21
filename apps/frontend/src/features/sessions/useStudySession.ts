import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // UC03/S01: pacote a cada 5 minutos

interface StudySessionResponse {
  id: string;
  xpAwarded: number;
  discardedReason: string | null;
}

interface UseStudySessionResult {
  isRunning: boolean;
  elapsedSeconds: number;
  lastResult: StudySessionResponse | null;
  start: (subject: string) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * O cronômetro exibido é só UI — a duração que conta para XP é sempre
 * recalculada pelo servidor a partir de timestamps do servidor (heartbeat
 * periódico), nunca do relógio do navegador (RN-ANTIFRAUDE, PRD seção 7.3).
 * Isso também é o que torna a aba em segundo plano no mobile inofensiva:
 * o navegador pode pausar o `setInterval`, mas o heartbeat retoma a contagem
 * correta do lado do servidor ao voltar o foco.
 */
export function useStudySession(): UseStudySessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastResult, setLastResult] = useState<StudySessionResponse | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    heartbeatRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(async (subject: string) => {
    const response = await apiClient.post<{ id: string }>('/sessions', {
      subject,
      mode: 'solo',
    });
    setSessionId(response.data.id);
    setElapsedSeconds(0);
    setIsRunning(true);
    setLastResult(null);

    tickRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    heartbeatRef.current = window.setInterval(() => {
      apiClient.patch(`/sessions/${response.data.id}/heartbeat`).catch(() => {
        /* falha de heartbeat não interrompe a UI — servidor reconcilia no complete */
      });
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stop = useCallback(async () => {
    if (!sessionId) return;
    clearTimers();
    setIsRunning(false);
    const response = await apiClient.post<StudySessionResponse>(
      `/sessions/${sessionId}/complete`,
    );
    setLastResult(response.data);
    setSessionId(null);
  }, [sessionId, clearTimers]);

  return { isRunning, elapsedSeconds, lastResult, start, stop };
}
