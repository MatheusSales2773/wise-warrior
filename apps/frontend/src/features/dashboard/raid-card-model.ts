import type { ActiveRaid, RaidHit } from '@/features/guild/api';
import { focusHoursNumber } from '@/features/guild/focus-hours';
import { formatPosition } from '@/features/guild/messages';
import { formatBattleTimeLeft, formatFocusHours, raidWeekGrid, type WeekDay } from '@/features/guild/raid-battle';

export type FuryDay = WeekDay & {
  /** Three letters of the weekday, "Seg". */
  abbreviation: string;
};

/** The seven days of the Raid week with the three-letter name the Fúria row prints under each one. */
export function furyDays(raid: Pick<ActiveRaid, 'weekDays' | 'studyDays' | 'today'>): FuryDay[] {
  return raidWeekGrid(raid).map((day) => ({ ...day, abbreviation: `${day.name.charAt(0).toUpperCase()}${day.name.slice(1, 3)}` }));
}

/** "4 de 7 dias com estudo": the Dias de estudo of the week so far over the days of the week. */
export function studyDaysSummary(days: readonly Pick<WeekDay, 'state'>[]): string {
  const studied = days.filter((day) => day.state === 'studied').length;
  return `${studied} de ${days.length} dias com estudo`;
}

export const furyRule = (furyPercent: number): string => `O chefe recupera ${furyPercent}% da vida a cada dia sem estudo na guilda.`;

/** What the Meta takes: the goal grows by the life the Fúria gave back, as on the Raid screen. */
function neededXp(raid: Pick<ActiveRaid, 'goalXp' | 'regeneratedXp'>): number {
  return raid.goalXp + raid.regeneratedXp;
}

/** "138h / 200h", in focus hours with the Raid screen's conversion. */
export function raidHours(raid: Pick<ActiveRaid, 'progressXp' | 'goalXp' | 'regeneratedXp'>): string {
  return `${formatFocusHours(raid.progressXp)} / ${formatFocusHours(neededXp(raid))}`;
}

/** The phone block's "138/200h": the unit once, after the goal. */
export function raidHoursCompact(raid: Pick<ActiveRaid, 'progressXp' | 'goalXp' | 'regeneratedXp'>): string {
  return `${focusHoursNumber(raid.progressXp)}/${formatFocusHours(neededXp(raid))}`;
}

export const raidBarMaximum = (raid: Pick<ActiveRaid, 'goalXp' | 'regeneratedXp'>): number => Math.max(1, neededXp(raid));

/** The bar never overflows: the Raid keeps taking Contributions after the Meta batida. */
export const raidBarValue = (raid: Pick<ActiveRaid, 'progressXp' | 'goalXp' | 'regeneratedXp'>): number => Math.min(raid.progressXp, raidBarMaximum(raid));

/** "Último golpe: Lia · +400 XP · 40 min"; the minutes are left out when the Study Session no longer exists. */
export function lastHitText({ displayName, xp, focusMinutes }: Pick<RaidHit, 'displayName' | 'xp' | 'focusMinutes'>): string {
  return `Último golpe: ${displayName} · +${xp} XP${focusMinutes === null ? '' : ` · ${focusMinutes} min`}`;
}

/** "3d 14h restantes · você: 4º"; the position is left out for who is not a Participant, and "restantes" on the phone. */
export function timeAndPosition(timeLeftMs: number, position: number | null, { long }: { long: boolean }): string {
  const time = formatBattleTimeLeft(timeLeftMs, { long });
  return position === null ? time : `${time} · você: ${formatPosition(position)}`;
}
