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

export class SessionMetricsResponseDto {
  currentStreakDays: number;
  longestStreakDays: number;
  sessionsToday: number;
  dailyGoal: 4;
  validSecondsToday: number;
  cadence: SessionMetricsCadenceDto;
}
