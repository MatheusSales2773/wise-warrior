import { saoPauloDayKey, saoPauloShiftDayKey, saoPauloWeekAt } from '../../../shared/time/sao-paulo-calendar';

export const NO_SUBJECT_LABEL = 'Sem matéria';
export const WEEK_SUBJECTS_LIMIT = 4;

/** A finished, non-discarded Study Session; the caller has already dropped discards and cancellations. */
export interface WeekSessionRow {
  endedAt: Date;
  subject: string | null;
  validSeconds: number;
  xpAwarded: number;
}

export interface WeekSummaryDay {
  date: string;
  sessionCount: number;
  validSeconds: number;
}

export interface WeekSummarySubject {
  subject: string;
  validSeconds: number;
}

export interface WeekSummary {
  /** Monday of the São Paulo week, `YYYY-MM-DD`. */
  weekStart: string;
  /** Sunday of the São Paulo week, `YYYY-MM-DD`. */
  weekEnd: string;
  today: string;
  validSeconds: number;
  sessionCount: number;
  xp: number;
  /** One entry per day, Monday to Sunday. */
  days: WeekSummaryDay[];
  /** The subjects with the most valid focus, most first. */
  subjects: WeekSummarySubject[];
}

export const subjectKey =(subject: string | null): string => (subject?.trim() ?? '').toLocaleLowerCase('pt-BR');

/** The week of `now` in São Paulo: totals, a bar per day and the top subjects. Sessions outside the week are ignored. */
export function buildWeekSummary(sessions: readonly WeekSessionRow[], now: Date): WeekSummary {
  const week = saoPauloWeekAt(now);
  // `endsAt` is Sunday 23:59:59.000; the week lasts until the next Monday begins.
  const nextWeekStartsAt = new Date(week.endsAt.getTime() + 1000);
  const weekStart = saoPauloDayKey(week.startsAt);
  const days: WeekSummaryDay[] = Array.from({ length: 7 }, (_, index) => ({
    date: saoPauloShiftDayKey(weekStart, index),
    sessionCount: 0,
    validSeconds: 0,
  }));
  const subjects = new Map<string, { subject: string; validSeconds: number; latestEndedAt: number }>();
  const summary = { validSeconds: 0, sessionCount: 0, xp: 0 };

  for (const session of sessions) {
    if (session.endedAt < week.startsAt || session.endedAt >= nextWeekStartsAt) continue;
    const day = days.find((candidate) => candidate.date === saoPauloDayKey(session.endedAt))!;
    day.sessionCount += 1;
    day.validSeconds += session.validSeconds;
    summary.sessionCount += 1;
    summary.validSeconds += session.validSeconds;
    summary.xp += session.xpAwarded;

    const key = subjectKey(session.subject);
    const entry = subjects.get(key) ?? { subject: NO_SUBJECT_LABEL, validSeconds: 0, latestEndedAt: -Infinity };
    entry.validSeconds += session.validSeconds;
    // The group is named by its most recent spelling.
    if (key !== '' && session.endedAt.getTime() >= entry.latestEndedAt) {
      entry.subject = session.subject!.trim();
      entry.latestEndedAt = session.endedAt.getTime();
    }
    subjects.set(key, entry);
  }

  return {
    weekStart,
    weekEnd: saoPauloShiftDayKey(weekStart, 6),
    today: saoPauloDayKey(now),
    ...summary,
    days,
    subjects: [...subjects.values()]
      .sort((a, b) => b.validSeconds - a.validSeconds || a.subject.localeCompare(b.subject, 'pt-BR'))
      .slice(0, WEEK_SUBJECTS_LIMIT)
      .map(({ subject, validSeconds }) => ({ subject, validSeconds })),
  };
}
