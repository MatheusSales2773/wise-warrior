import { zonedDayKey, zonedDayStart } from './raid-week';

/** Fúria do dragão (ADR-012): the percent of the goal the boss recovers per day, when `RAID_FURY_REGEN_PERCENT` is unset. */
export const DEFAULT_RAID_FURY_REGEN_PERCENT = 5;

/**
 * `RAID_FURY_REGEN_PERCENT`, read from the environment on every call like the other game parameters. Missing,
 * not an integer or outside 0 to 100 falls back to the default.
 */
export function getRaidFuryRegenPercent(): number {
  const raw = process.env.RAID_FURY_REGEN_PERCENT?.trim();
  const percent = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(percent) && percent >= 0 && percent <= 100 ? percent : DEFAULT_RAID_FURY_REGEN_PERCENT;
}

/** The XP the boss recovers on one Fúria day: the percent of the goal, rounded down. */
export function furyRegenXp(goalXp: number, percent: number): number {
  return Math.floor((goalXp * percent) / 100);
}

/**
 * The days on which the Fúria is owed by `now`: whole days of the Raid that are already over and were not a Dia de
 * estudo. Today is still going; the day the Raid opened midway is partial; the last day of the week is closed by
 * the weekly closing at the same moment, so none of them count.
 */
export function furyDaysDue({ weekDays, openedAt, studyDays, now }: {
  weekDays: readonly string[];
  openedAt: Date;
  studyDays: readonly string[];
  now: Date;
}): string[] {
  const today = zonedDayKey(now);
  const studied = new Set(studyDays);
  return weekDays
    .slice(0, -1)
    .filter((day) => day < today && !studied.has(day) && zonedDayStart(day).getTime() >= openedAt.getTime());
}

/** Vida do chefe: o que falta para a Meta batida, `goalXp − progressXp + regeneratedXp`, entre 0 e `goalXp`. */
export function bossHealthXp({ goalXp, progressXp, regeneratedXp }: { goalXp: number; progressXp: number; regeneratedXp: number }): number {
  return Math.min(goalXp, Math.max(0, goalXp - progressXp + regeneratedXp));
}
