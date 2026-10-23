export type SessionMetricsIntensity = 0 | 1 | 2 | 3 | 4;

export class SessionMetricsCadenceDayDto {
  date: string;
  sessionCount: number;
  validSeconds: number;
  intensity: SessionMetricsIntensity;
}

export class SessionMetricsCadenceDto {
  windowStart: string;
  windowEnd: string;
  days: SessionMetricsCadenceDayDto[];
}

export class SessionMetricsKindTotalsDto {
  sessionCount: number;
  validSeconds: number;
}

export class SessionMetricsResponseDto {
  currentStreakDays: number;
  longestStreakDays: number;
  sessionsToday: number;
  dailyGoal: 4;
  validSecondsToday: number;
  /** Hoje, por tipo: `cycle` (Ciclo) e `free` (Foco livre). */
  todayByKind: { cycle: SessionMetricsKindTotalsDto; free: SessionMetricsKindTotalsDto };
  cadence: SessionMetricsCadenceDto;
}
