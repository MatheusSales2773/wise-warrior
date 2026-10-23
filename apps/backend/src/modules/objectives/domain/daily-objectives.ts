import { Logger } from '@nestjs/common';
import type { FinishedSessionOfDay } from '../../sessions/domain/counted-session';

/**
 * Objetivos diários de Crônicas (ADR-014): lista fixa, igual para todos, configurável no servidor.
 * Pagam Moedas, nunca XP nem Contribuição de Raid.
 */
export interface DailyObjectiveDefinition {
  /** Entra na referência do Extrato (`<id>:<dia>`), então não pode mudar depois de pago. */
  id: string;
  title: string;
  /** Quantas sessões contam para cumprir o Objetivo. */
  target: number;
  /** Só conta a sessão com pelo menos estes minutos de foco válido; sem o campo, toda sessão conta. */
  minValidMinutes?: number;
  coins: number;
}

export interface DailyObjectiveProgress {
  progress: number;
  target: number;
  completed: boolean;
}

export const DEFAULT_DAILY_OBJECTIVES: readonly DailyObjectiveDefinition[] = [
  { id: 'one-session', title: 'Conclua 1 sessão de foco', target: 1, coins: 5 },
  { id: 'four-sessions', title: 'Conclua 4 sessões hoje', target: 4, coins: 15 },
  { id: 'fifty-minutes', title: 'Faça uma sessão de 50 minutos', target: 1, minValidMinutes: 50, coins: 10 },
];

const MAX_ID_LENGTH = 32;

function isDefinition(value: unknown): value is DailyObjectiveDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const { id, title, target, minValidMinutes, coins } = value as Record<string, unknown>;
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH && !id.includes(':')
    && typeof title === 'string' && title.trim().length > 0
    && (minValidMinutes === undefined || (Number.isSafeInteger(minValidMinutes) && (minValidMinutes as number) >= 1))
    && Number.isSafeInteger(target) && (target as number) >= 1
    && Number.isSafeInteger(coins) && (coins as number) >= 0;
}

/**
 * A lista de Objetivos, lida de `DAILY_OBJECTIVES` (JSON) a cada chamada como os demais parâmetros de economia.
 * Ausente ou inválida, vazia ou com ids repetidos cai no padrão da ADR-014.
 */
export function getDailyObjectives(): readonly DailyObjectiveDefinition[] {
  const raw = process.env.DAILY_OBJECTIVES?.trim();
  if (!raw) return DEFAULT_DAILY_OBJECTIVES;
  const parsed = parseObjectives(raw);
  if (parsed) return parsed;
  // Um erro de digitação na configuração não pode passar em silêncio: avisa uma vez por valor e usa o padrão.
  if (raw !== warnedRaw) {
    warnedRaw = raw;
    new Logger('DailyObjectives').warn('DAILY_OBJECTIVES é inválida; usando a lista padrão da ADR-014');
  }
  return DEFAULT_DAILY_OBJECTIVES;
}

let warnedRaw: string | undefined;

function parseObjectives(raw: string): DailyObjectiveDefinition[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isDefinition)) return null;
    return new Set(parsed.map(({ id }) => id)).size === parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/** Progresso de um Objetivo a partir das sessões do dia de São Paulo; o foco válido é o das sessões, sem pausas. */
export function dailyObjectiveProgress(
  objective: DailyObjectiveDefinition,
  sessionsOfDay: readonly FinishedSessionOfDay[],
): DailyObjectiveProgress {
  const minSeconds = (objective.minValidMinutes ?? 0) * 60;
  const reached = sessionsOfDay.filter(({ validSeconds }) => validSeconds >= minSeconds).length;
  const progress = Math.min(reached, objective.target);
  return { progress, target: objective.target, completed: progress >= objective.target };
}
