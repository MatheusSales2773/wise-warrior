export const RAID_TIME_ZONE = 'America/Sao_Paulo';
export const RAID_XP_PER_MEMBER = 1500;
const GOAL_STEP_XP = 50;
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 1970-01-05 was the first Monday of the Unix epoch: week 0. */
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

export interface RaidWeek {
  /** Weeks elapsed since the first Monday of the Unix epoch. */
  number: number;
  startsAt: Date;
  /** Sunday 23:59:59 in São Paulo. */
  endsAt: Date;
}

const zoneFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: RAID_TIME_ZONE,
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

export function raidWeekAt(now: Date): RaidWeek {
  const wall = new Date(zonedWallClockMs(now.getTime()));
  const daysSinceMonday = (wall.getUTCDay() + 6) % 7;
  const mondayWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - daysSinceMonday);
  const nextMondayWall = mondayWall + 7 * DAY_MS;
  return {
    number: Math.round((mondayWall - FIRST_MONDAY_MS) / (7 * DAY_MS)),
    startsAt: new Date(instantAtWallClock(mondayWall)),
    endsAt: new Date(instantAtWallClock(nextMondayWall) - 1000),
  };
}

/** Week N uses the mission at position `N mod catalog size`, the same for every Guild. */
export function missionIndexForWeek(weekNumber: number, catalogSize: number): number {
  return ((weekNumber % catalogSize) + catalogSize) % catalogSize;
}

/** 1.500 XP per member for the whole week, scaled to the time left and rounded up to a multiple of 50. */
export function proportionalGoalXp(memberCount: number, week: RaidWeek, now: Date): number {
  const secondsLeft = Math.min(
    SECONDS_PER_WEEK,
    Math.max(0, Math.ceil((week.endsAt.getTime() + 1000 - now.getTime()) / 1000)),
  );
  const exact = (RAID_XP_PER_MEMBER * memberCount * secondsLeft) / SECONDS_PER_WEEK;
  return Math.max(GOAL_STEP_XP, Math.ceil(exact / GOAL_STEP_XP) * GOAL_STEP_XP);
}
