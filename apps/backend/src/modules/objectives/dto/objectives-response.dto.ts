export class DailyObjectiveDto {
  id: string;
  title: string;
  progress: number;
  target: number;
  /** Moedas pagas, uma vez, quando o Objetivo é cumprido. */
  coins: number;
  completed: boolean;
}

export class DailyObjectivesDto {
  /** O dia de São Paulo (`YYYY-MM-DD`) que estes Objetivos cobrem. */
  date: string;
  /** ISO 8601: a meia-noite de São Paulo em que os Objetivos renovam. */
  renewsAt: string;
  items: DailyObjectiveDto[];
}

export class WeeklyObjectiveDto extends DailyObjectiveDto {
  /** O que `progress` e `target` contam: dias, minutos de foco válido ou matérias. */
  unit: 'days' | 'minutes' | 'subjects';
}

export class WeeklyObjectivesDto {
  /** A segunda-feira (`YYYY-MM-DD`) da semana de São Paulo que estes Objetivos cobrem. */
  weekStart: string;
  /** ISO 8601: a segunda 00:00 de São Paulo em que os Objetivos renovam. */
  renewsAt: string;
  items: WeeklyObjectiveDto[];
}

export class ObjectivesResponseDto {
  daily: DailyObjectivesDto;
  weekly: WeeklyObjectivesDto;
}
