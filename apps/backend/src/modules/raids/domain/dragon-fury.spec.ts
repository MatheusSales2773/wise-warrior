import { furyDaysDue, furyRegenXp } from './dragon-fury';
import { saoPauloWeekAt } from '../../../shared/time/sao-paulo-calendar';
import { raidWeekDayKeys } from './raid-week';

// Week of Monday 2026-10-05 to Sunday 2026-10-11 in São Paulo (UTC-3).
const week = saoPauloWeekAt(new Date('2026-10-07T15:00:00Z'));
const weekDays = raidWeekDayKeys(week);
const at = (iso: string) => new Date(iso);

describe('furyDaysDue', () => {
  it('returns each whole day already over that was not a Dia de estudo', () => {
    const due = furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: ['2026-10-06'], now: at('2026-10-08T15:00:00Z') });

    expect(due).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('does not count today, which is still going', () => {
    const due = furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: [], now: at('2026-10-05T14:00:00Z') });

    expect(due).toEqual([]);
  });

  it('turns the day over at midnight in São Paulo, not in UTC', () => {
    // 2026-10-06T02:59:59Z is still Monday night in São Paulo; 03:00:00Z is Tuesday.
    expect(furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: [], now: at('2026-10-06T02:59:59Z') })).toEqual([]);
    expect(furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: [], now: at('2026-10-06T03:00:00Z') })).toEqual(['2026-10-05']);
  });

  it('skips the partial day in which the Raid was opened', () => {
    const due = furyDaysDue({ weekDays, openedAt: at('2026-10-07T15:00:00Z'), studyDays: [], now: at('2026-10-09T15:00:00Z') });

    expect(due).toEqual(['2026-10-08']);
  });

  it('counts the opening day when the Raid opened exactly at its midnight', () => {
    const due = furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: [], now: at('2026-10-06T15:00:00Z') });

    expect(due).toEqual(['2026-10-05']);
  });

  it('never counts the last day of the week', () => {
    const due = furyDaysDue({ weekDays, openedAt: week.startsAt, studyDays: [], now: at('2026-10-12T02:00:00Z') });

    expect(due).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
  });
});

describe('furyRegenXp', () => {
  it('is the percent of the goal, rounded down to a whole XP', () => {
    expect(furyRegenXp(1500, 5)).toBe(75);
    expect(furyRegenXp(50, 5)).toBe(2);
  });
});
