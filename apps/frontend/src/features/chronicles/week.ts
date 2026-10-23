import type { WeekSummary } from '@/features/dashboard/api';

export const CHART_MAX_HEIGHT = 96;
const CHART_MIN_HEIGHT = 4;
/** Monday to Sunday. */
const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
const WEEKDAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

/** "9h 40", "2h 05", or "40 min" under one hour. */
export function formatFocusTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes} min` : `${hours}h ${String(minutes).padStart(2, '0')}`;
}

export type WeekBar = { date: string; initial: string; label: string; height: number; today: boolean };

/** One bar per day, Monday to Sunday, scaled to the busiest day; today is flagged for the highlight. */
export function weekBars(summary: Pick<WeekSummary, 'days' | 'today'>): WeekBar[] {
  const peak = Math.max(...summary.days.map((day) => day.validSeconds), 0);
  return summary.days.map((day, index) => ({
    date: day.date,
    initial: WEEKDAY_INITIALS[index] ?? '',
    label: `${WEEKDAY_NAMES[index] ?? ''}: ${formatFocusTime(day.validSeconds)}`,
    height: peak === 0 ? CHART_MIN_HEIGHT : Math.max(CHART_MIN_HEIGHT, Math.round((day.validSeconds / peak) * CHART_MAX_HEIGHT)),
    today: day.date === summary.today,
  }));
}

/** Share of the top subject's focus, 0-100, for the progress bars. */
export function subjectShare(validSeconds: number, topValidSeconds: number): number {
  return topValidSeconds <= 0 ? 0 : Math.round((validSeconds / topValidSeconds) * 100);
}
