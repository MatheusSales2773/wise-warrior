export interface SessionActivityDay {
  date: string;
  sessionCount: number;
  validSeconds: number;
}

/** Activity of one UTC hour, as stored: São Paulo's offset is whole hours, so an hour never straddles two of its days. */
export interface SessionActivityHour {
  /** `YYYY-MM-DD HH` in UTC. */
  hour: string;
  sessionCount: number;
  validSeconds: number;
}

export interface SessionStreaks {
  currentStreakDays: number;
  longestStreakDays: number;
}

const previousDay = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

export function calculateStreaks(
  activityDates: readonly string[],
  today: string,
): SessionStreaks {
  const dates = new Set(activityDates);
  let longestStreakDays = 0;
  let run = 0;
  let previous: string | undefined;

  for (const date of [...dates].sort()) {
    run = previous && date === nextDay(previous) ? run + 1 : 1;
    longestStreakDays = Math.max(longestStreakDays, run);
    previous = date;
  }

  let currentStreakDays = 0;
  let cursor = dates.has(today) ? today : previousDay(today);
  while (dates.has(cursor)) {
    currentStreakDays += 1;
    cursor = previousDay(cursor);
  }

  return { currentStreakDays, longestStreakDays };
}

export function buildCadence(
  activity: readonly SessionActivityDay[],
  windowStart: string,
  windowEnd: string,
): SessionActivityDay[] {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const days: SessionActivityDay[] = [];
  let cursor = windowStart;

  while (cursor <= windowEnd) {
    const day = byDate.get(cursor);
    days.push({
      date: cursor,
      sessionCount: day?.sessionCount ?? 0,
      validSeconds: day?.validSeconds ?? 0,
    });
    cursor = nextDay(cursor);
  }
  return days;
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/** Folds hourly UTC activity into days, using `dayKeyOf` to name the day an hour belongs to. */
export function groupActivityByDay(
  hours: readonly SessionActivityHour[],
  dayKeyOf: (instant: Date) => string,
): SessionActivityDay[] {
  const byDay = new Map<string, SessionActivityDay>();
  for (const { hour, sessionCount, validSeconds } of hours) {
    const date = dayKeyOf(new Date(`${hour.replace(' ', 'T')}:00:00Z`));
    const day = byDay.get(date) ?? { date, sessionCount: 0, validSeconds: 0 };
    day.sessionCount += sessionCount;
    day.validSeconds += validSeconds;
    byDay.set(date, day);
  }
  return [...byDay.values()];
}
