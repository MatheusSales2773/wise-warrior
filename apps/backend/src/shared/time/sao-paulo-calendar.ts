/**
 * The single place that says which São Paulo day and week (Monday to Sunday) an instant belongs to.
 * Dashboard metrics, the session history, Raids and Crônicas all read the calendar from here.
 */
export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 1970-01-05 was the first Monday of the Unix epoch: week 0. */
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

export interface SaoPauloWeek {
  /** Weeks elapsed since the first Monday of the Unix epoch. */
  number: number;
  /** Monday 00:00 in São Paulo. */
  startsAt: Date;
  /** Sunday 23:59:59 in São Paulo. */
  endsAt: Date;
}

const zoneFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

/** The wall-clock reading in São Paulo of an instant, as if it were UTC. */
function zonedWallClockMs(instantMs: number): number {
  const parts = Object.fromEntries(
    zoneFormat.formatToParts(new Date(instantMs)).map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** The instant at which São Paulo's wall clock reads `wallClockMs` (read as UTC). */
function instantAtWallClock(wallClockMs: number): number {
  const guess = wallClockMs - (zonedWallClockMs(wallClockMs) - wallClockMs);
  return wallClockMs - (zonedWallClockMs(guess) - guess);
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The São Paulo calendar day (`YYYY-MM-DD`) of an instant. */
export function saoPauloDayKey(instant: Date): string {
  return dayFormat.format(instant);
}

/** The instant at which a São Paulo calendar day (`YYYY-MM-DD`) begins. */
export function saoPauloDayStart(dayKey: string): Date {
  return new Date(instantAtWallClock(Date.parse(`${dayKey}T00:00:00Z`)));
}

/** Whether `value` is a real calendar day written as `YYYY-MM-DD` (rejects `2026-02-30`). */
export function isSaoPauloDayKey(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Moves a day key by whole calendar days (negative goes back). */
export function saoPauloShiftDayKey(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export const saoPauloNextDayKey = (dayKey: string): string => saoPauloShiftDayKey(dayKey, 1);

export const saoPauloPreviousDayKey = (dayKey: string, days = 1): string => saoPauloShiftDayKey(dayKey, -days);

/** The São Paulo week (Monday to Sunday) an instant belongs to. */
export function saoPauloWeekAt(instant: Date): SaoPauloWeek {
  const wall = new Date(zonedWallClockMs(instant.getTime()));
  const daysSinceMonday = (wall.getUTCDay() + 6) % 7;
  const mondayWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - daysSinceMonday);
  const nextMondayWall = mondayWall + 7 * DAY_MS;
  return {
    number: Math.round((mondayWall - FIRST_MONDAY_MS) / (7 * DAY_MS)),
    startsAt: new Date(instantAtWallClock(mondayWall)),
    endsAt: new Date(instantAtWallClock(nextMondayWall) - 1000),
  };
}
