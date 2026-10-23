import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { saoPauloDayKey, saoPauloDayStart, saoPauloNextDayKey, saoPauloWeekAt } from '../../shared/time/sao-paulo-calendar';
import type { CoinMovementResult } from '../economy/domain/coin-origin';
import { EconomyService } from '../economy/economy.service';
import { SessionsService } from '../sessions/sessions.service';
import { dailyObjectiveProgress, getDailyObjectives, type DailyObjectiveDefinition } from './domain/daily-objectives';
import { getWeeklyObjectives, weeklyObjectiveProgress, type WeeklyObjectiveDefinition, type WeeklyObjectiveKind } from './domain/weekly-objectives';
import type { ObjectivesResponseDto } from './dto/objectives-response.dto';

export type ObjectivesClock = { now(): Date };
export const OBJECTIVES_CLOCK = Symbol('OBJECTIVES_CLOCK');

/** `<id>:<dia>`: a referência que torna o crédito de um Objetivo idempotente por dia (ADR-014). */
export const dailyObjectiveOriginRef = (objective: DailyObjectiveDefinition, dayKey: string): string =>
  `${objective.id}:${dayKey}`;

/** `weekly:<id>:<segunda>`: a referência que torna o crédito de um Objetivo semanal idempotente por semana (ADR-014). */
export const weeklyObjectiveOriginRef = (objective: WeeklyObjectiveDefinition, weekStartKey: string): string =>
  `weekly:${objective.id}:${weekStartKey}`;

const WEEKLY_UNITS: Record<WeeklyObjectiveKind, 'days' | 'minutes' | 'subjects'> = {
  'distinct-days': 'days',
  'focus-minutes': 'minutes',
  'distinct-subjects': 'subjects',
};

/**
 * Objetivos de Crônicas (ADR-014). Lê as Study Sessions pelo `SessionsService` e paga pelo `EconomyService` (ADR-001).
 * Objetivos nunca dão XP nem Contribuição de Raid.
 */
@Injectable()
export class ObjectivesService {
  constructor(
    private readonly economy: EconomyService,
    @Inject(forwardRef(() => SessionsService)) private readonly sessions: SessionsService,
    @Inject(OBJECTIVES_CLOCK) private readonly clock: ObjectivesClock,
  ) {}

  /** Os Objetivos de hoje e da semana (São Paulo) com o progresso de quem pede. */
  async list(userId: string): Promise<ObjectivesResponseDto> {
    const instant = this.clock.now();
    const date = saoPauloDayKey(instant);
    const [sessionsOfDay, sessionsOfWeek] = await Promise.all([
      this.sessions.finishedSessionsOfDay(userId, date),
      this.sessions.finishedSessionsOfWeek(userId, instant),
    ]);
    const week = saoPauloWeekAt(instant);
    return {
      daily: {
        date,
        renewsAt: saoPauloDayStart(saoPauloNextDayKey(date)).toISOString(),
        items: getDailyObjectives().map((objective) => ({
          id: objective.id,
          title: objective.title,
          coins: objective.coins,
          ...dailyObjectiveProgress(objective, sessionsOfDay),
        })),
      },
      weekly: {
        weekStart: saoPauloDayKey(week.startsAt),
        renewsAt: new Date(week.endsAt.getTime() + 1000).toISOString(),
        items: getWeeklyObjectives().map((objective) => ({
          id: objective.id,
          title: objective.title,
          coins: objective.coins,
          unit: WEEKLY_UNITS[objective.kind],
          ...weeklyObjectiveProgress(objective, sessionsOfWeek),
        })),
      },
    };
  }

  /**
   * Paga os Objetivos do dia e da semana de `endedAt` que a Study Session recém-salva cumpriu. Roda na transação de
   * quem a terminou, depois de salvá-la, com a linha de `users` já travada. Reprocessar não paga de novo: a origem já
   * valeu. Quem chama publica os movimentos `applied` depois do commit (`EconomyService.publishBalanceChanged`).
   */
  async settleInTransaction(manager: EntityManager, userId: string, endedAt: Date): Promise<CoinMovementResult[]> {
    const dayKey = saoPauloDayKey(endedAt);
    const weekStartKey = saoPauloDayKey(saoPauloWeekAt(endedAt).startsAt);
    const [sessionsOfDay, sessionsOfWeek] = await Promise.all([
      this.sessions.finishedSessionsOfDay(userId, dayKey, manager),
      this.sessions.finishedSessionsOfWeek(userId, endedAt, manager),
    ]);
    const movements: CoinMovementResult[] = [];
    for (const objective of getDailyObjectives()) {
      if (!dailyObjectiveProgress(objective, sessionsOfDay).completed) continue;
      movements.push(await this.economy.credit(manager, userId, objective.coins, {
        type: 'objective',
        ref: dailyObjectiveOriginRef(objective, dayKey),
      }));
    }
    for (const objective of getWeeklyObjectives()) {
      if (!weeklyObjectiveProgress(objective, sessionsOfWeek).completed) continue;
      movements.push(await this.economy.credit(manager, userId, objective.coins, {
        type: 'objective',
        ref: weeklyObjectiveOriginRef(objective, weekStartKey),
      }));
    }
    return movements;
  }
}
