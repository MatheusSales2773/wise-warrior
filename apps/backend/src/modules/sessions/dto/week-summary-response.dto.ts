export class WeekSummaryDayDto {
  date: string;
  sessionCount: number;
  validSeconds: number;
}

export class WeekSummarySubjectDto {
  subject: string;
  validSeconds: number;
}

export class WeekSummaryResponseDto {
  weekStart: string;
  weekEnd: string;
  today: string;
  validSeconds: number;
  sessionCount: number;
  xp: number;
  days: WeekSummaryDayDto[];
  subjects: WeekSummarySubjectDto[];
}
