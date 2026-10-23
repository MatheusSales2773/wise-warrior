import { Logger } from '@nestjs/common';
import { saoPauloDayKey } from '../../../shared/time/sao-paulo-calendar';
import type { FinishedSessionOfWeek } from '../../sessions/domain/counted-session';
import { subjectKey } from '../../sessions/domain/week-summary';

/** What a weekly Objetivo measures; the progress and the target share its unit. */
export type WeeklyObjectiveKind = 'distinct-days' | 'focus-minutes' | 'distinct-subjects';

/**
 * Objetivos semanais de Crônicas (ADR-014): lista fixa, igual para todos, configurável no servidor.
 * Pagam Moedas, nunca XP nem Contribuição de Raid.
 */
export interface WeeklyObjectiveDefinition {
  /** Entra na referência do Extrato (`<id>:<segunda>`), então não pode mudar depois de pago. */
  id: string;
  title: string;
  kind: WeeklyObjectiveKind;
  /** Dias, minutos de foco válido ou matérias, conforme o `kind`. */
  target: number;
  coins: number;
}

export interface WeeklyObjectiveProgress {
  progress: number;
  target: number;
  completed: boolean;
}

export const DEFAULT_WEEKLY_OBJECTIVES: readonly WeeklyObjectiveDefinition[] = [
  { id: 'five-days', title: 'Estude em 5 dias diferentes', kind: 'distinct-days', target: 5, coins: 40 },
  { id: 'five-hours', title: 'Estude 5h nesta semana', kind: 'focus-minutes', target: 300, coins: 50 },
  { id: 'three-subjects', title: 'Estude 3 matérias diferentes', kind: 'distinct-subjects', target: 3, coins: 30 },
];

const MAX_ID_LENGTH = 32;
const KINDS: readonly string[] = ['distinct-days', 'focus-minutes', 'distinct-subjects'] satisfies WeeklyObjectiveKind[];

function isDefinition(value: unknown): value is WeeklyObjectiveDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const { id, title, kind, target, coins } = value as Record<string, unknown>;
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH && !id.includes(':')
    && typeof title === 'string' && title.trim().length > 0
    && typeof kind === 'string' && KINDS.includes(kind)
    && Number.isSafeInteger(target) && (target as number) >= 1
    && Number.isSafeInteger(coins) && (coins as number) >= 0;
}

/**
 * A lista de Objetivos, lida de `WEEKLY_OBJECTIVES` (JSON) a cada chamada como os diários.
 * Ausente ou inválida, vazia ou com ids repetidos cai no padrão da ADR-014.
 */
export function getWeeklyObjectives(): readonly WeeklyObjectiveDefinition[] {
  const raw = process.env.WEEKLY_OBJECTIVES?.trim();
  if (!raw) return DEFAULT_WEEKLY_OBJECTIVES;
  const parsed = parseObjectives(raw);
  if (parsed) return parsed;
  if (raw !== warnedRaw) {
    warnedRaw = raw;
    new Logger('WeeklyObjectives').warn('WEEKLY_OBJECTIVES é inválida; usando a lista padrão da ADR-014');
  }
  return DEFAULT_WEEKLY_OBJECTIVES;
}

let warnedRaw: string | undefined;

function parseObjectives(raw: string): WeeklyObjectiveDefinition[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isDefinition)) return null;
    return new Set(parsed.map(({ id }) => id)).size === parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Progresso de um Objetivo a partir das sessões da semana de São Paulo. As matérias seguem o agrupamento do Diário
 * (sem diferenciar maiúsculas nem espaços nas pontas) e a sessão sem matéria não conta como uma.
 */
export function weeklyObjectiveProgress(
  objective: WeeklyObjectiveDefinition,
  sessionsOfWeek: readonly FinishedSessionOfWeek[],
): WeeklyObjectiveProgress {
  const reached = measure(objective.kind, sessionsOfWeek);
  const progress = Math.min(reached, objective.target);
  return { progress, target: objective.target, completed: progress >= objective.target };
}

function measure(kind: WeeklyObjectiveKind, sessions: readonly FinishedSessionOfWeek[]): number {
  switch (kind) {
    case 'distinct-days':
      return new Set(sessions.map(({ endedAt }) => saoPauloDayKey(endedAt))).size;
    case 'focus-minutes':
      return Math.floor(sessions.reduce((total, { validSeconds }) => total + validSeconds, 0) / 60);
    case 'distinct-subjects':
      return new Set(sessions.map(({ subject }) => subjectKey(subject)).filter((key) => key !== '')).size;
  }
}
