import {
  saoPauloDayKey,
  saoPauloShiftDayKey as shiftDayKey,
  type SaoPauloWeek,
} from '../../../shared/time/sao-paulo-calendar';

export const RAID_XP_PER_MEMBER = 1500;
const GOAL_STEP_XP = 50;
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;

/** Week N uses the mission at position `N mod catalog size`, the same for every Guild. */
export function missionIndexForWeek(weekNumber: number, catalogSize: number): number {
  return ((weekNumber % catalogSize) + catalogSize) % catalogSize;
}

/** 1.500 XP per member for the whole week, scaled to the time left and rounded up to a multiple of 50. */
export function proportionalGoalXp(memberCount: number, week: SaoPauloWeek, now: Date): number {
  const secondsLeft = Math.min(
    SECONDS_PER_WEEK,
    Math.max(0, Math.ceil((week.endsAt.getTime() + 1000 - now.getTime()) / 1000)),
  );
  const exact = (RAID_XP_PER_MEMBER * memberCount * secondsLeft) / SECONDS_PER_WEEK;
  return Math.max(GOAL_STEP_XP, Math.ceil(exact / GOAL_STEP_XP) * GOAL_STEP_XP);
}

/**
 * Dia de estudo: the distinct São Paulo days with at least one Contribuição. The single place this is
 * computed; callers pass the Contribuição instants of the Raid (solo Study Sessions never reach it).
 */
export function studyDaysOf(contributionInstants: Date[]): string[] {
  return [...new Set(contributionInstants.map(saoPauloDayKey))].sort();
}

/** Sequência: Dias de estudo in a row within the week, ending today if studied, else yesterday. */
export function studyStreak(studyDays: string[], week: SaoPauloWeek, now: Date): number {
  const studied = new Set(studyDays);
  const weekStartDay = saoPauloDayKey(week.startsAt);
  const today = saoPauloDayKey(now);
  let day = studied.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (day >= weekStartDay && studied.has(day)) {
    streak += 1;
    day = shiftDayKey(day, -1);
  }
  return streak;
}

/** The seven São Paulo days of the Raid week, Monday first, as `YYYY-MM-DD`. */
export function raidWeekDayKeys(week: SaoPauloWeek): string[] {
  const monday = saoPauloDayKey(week.startsAt);
  return Array.from({ length: 7 }, (_, index) => shiftDayKey(monday, index));
}
