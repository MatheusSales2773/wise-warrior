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

export class ObjectivesResponseDto {
  daily: DailyObjectivesDto;
}
