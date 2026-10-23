import { getAuthenticatedHttpClient } from '@/core/api/api-client';

/* Objetivos de Crônicas (ADR-014, `docs/api/openapi.yaml`). */

export type DailyObjective = {
  id: string;
  title: string;
  progress: number;
  target: number;
  /** Moedas pagas uma vez, automaticamente, quando o Objetivo é cumprido. */
  coins: number;
  completed: boolean;
};

export type WeeklyObjective = DailyObjective & {
  /** O que `progress` e `target` contam: dias, minutos de foco válido ou matérias. */
  unit: 'days' | 'minutes' | 'subjects';
};

export type Objectives = {
  daily: {
    /** O dia de São Paulo (`YYYY-MM-DD`) coberto. */
    date: string;
    /** ISO 8601: a meia-noite de São Paulo em que os Objetivos renovam. */
    renewsAt: string;
    items: DailyObjective[];
  };
  weekly: {
    /** A segunda-feira (`YYYY-MM-DD`) da semana de São Paulo coberta. */
    weekStart: string;
    /** ISO 8601: a segunda 00:00 de São Paulo em que os Objetivos renovam. */
    renewsAt: string;
    items: WeeklyObjective[];
  };
};

export async function getObjectives({ signal }: { signal?: AbortSignal } = {}): Promise<Objectives> {
  const response = await getAuthenticatedHttpClient().get<Objectives>('/objectives', { signal });
  return response.data;
}
