export interface SessionActivityDay {
  date: string;
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
