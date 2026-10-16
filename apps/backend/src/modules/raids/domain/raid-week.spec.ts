import { missionIndexForWeek, proportionalGoalXp, raidWeekAt, raidWeekDayKeys, studyDaysOf, studyStreak } from './raid-week';

describe('raidWeekAt', () => {
  it('runs from Monday 00:00 to Sunday 23:59:59 in America/Sao_Paulo, stored in UTC', () => {
    // Wednesday 2026-10-07 12:00 in São Paulo (UTC-3)
    const week = raidWeekAt(new Date('2026-10-07T15:00:00Z'));
    expect(week.startsAt.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(week.endsAt.toISOString()).toBe('2026-10-12T02:59:59.000Z');
  });

  it('keeps Sunday night in the week that is ending, even when UTC is already Monday', () => {
    // Sunday 2026-10-11 22:00 in São Paulo is Monday 01:00 UTC
    const week = raidWeekAt(new Date('2026-10-12T01:00:00Z'));
    expect(week.startsAt.toISOString()).toBe('2026-10-05T03:00:00.000Z');
  });

  it('starts a new week at Monday 00:00 in São Paulo', () => {
    const week = raidWeekAt(new Date('2026-10-12T03:00:00Z'));
    expect(week.startsAt.toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('numbers consecutive weeks consecutively', () => {
    const a = raidWeekAt(new Date('2026-10-07T15:00:00Z'));
    const b = raidWeekAt(new Date('2026-10-14T15:00:00Z'));
    expect(b.number).toBe(a.number + 1);
  });
});

describe('missionIndexForWeek', () => {
  it('rotates deterministically: week N uses mission N mod catalog size', () => {
    expect(missionIndexForWeek(8, 4)).toBe(0);
    expect(missionIndexForWeek(9, 4)).toBe(1);
    expect(missionIndexForWeek(11, 4)).toBe(3);
    expect(missionIndexForWeek(12, 4)).toBe(0);
  });
});

describe('proportionalGoalXp', () => {
  it('is 1500 XP per member for the whole week', () => {
    const week = raidWeekAt(new Date('2026-10-05T03:00:00Z'));
    expect(proportionalGoalXp(1, week, new Date('2026-10-05T03:00:00Z'))).toBe(1500);
    expect(proportionalGoalXp(3, week, new Date('2026-10-05T03:00:00Z'))).toBe(4500);
  });

  it('is proportional to the time left and rounds up to a multiple of 50', () => {
    const week = raidWeekAt(new Date('2026-10-05T03:00:00Z'));
    // Exactly half of the week left: 750 XP for one member.
    expect(proportionalGoalXp(1, week, new Date('2026-10-08T15:00:00Z'))).toBe(750);
    // 1500 * 1/7 ≈ 214.3 -> 250
    expect(proportionalGoalXp(1, week, new Date('2026-10-11T03:00:00Z'))).toBe(250);
  });
});

describe('studyDaysOf', () => {
  it('maps contribution instants to distinct São Paulo calendar days', () => {
    // 2026-10-08T02:30Z is still Wednesday 23:30 in São Paulo
    const days = studyDaysOf([
      new Date('2026-10-07T15:00:00Z'),
      new Date('2026-10-08T02:30:00Z'),
      new Date('2026-10-08T03:00:00Z'),
    ]);
    expect(days).toEqual(['2026-10-07', '2026-10-08']);
  });

  it('returns the days in order', () => {
    expect(studyDaysOf([new Date('2026-10-08T15:00:00Z'), new Date('2026-10-06T15:00:00Z')]))
      .toEqual(['2026-10-06', '2026-10-08']);
  });
});

describe('studyStreak', () => {
  const week = raidWeekAt(new Date('2026-10-07T15:00:00Z')); // Mon 2026-10-05

  it('is zero without Dias de estudo', () => {
    expect(studyStreak([], week, new Date('2026-10-07T15:00:00Z'))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(studyStreak(['2026-10-05', '2026-10-06', '2026-10-07'], week, new Date('2026-10-07T15:00:00Z'))).toBe(3);
  });

  it('does not break when today has no study yet: counts up to yesterday', () => {
    expect(studyStreak(['2026-10-05', '2026-10-06'], week, new Date('2026-10-07T15:00:00Z'))).toBe(2);
  });

  it('breaks on a missed day', () => {
    expect(studyStreak(['2026-10-05', '2026-10-07'], week, new Date('2026-10-07T15:00:00Z'))).toBe(1);
  });

  it('is zero when yesterday and today had no study', () => {
    expect(studyStreak(['2026-10-05'], week, new Date('2026-10-07T15:00:00Z'))).toBe(0);
  });

  it('resets on Monday: Sunday of the previous week does not count', () => {
    const monday = new Date('2026-10-12T12:00:00Z');
    expect(studyStreak(['2026-10-10', '2026-10-11'], raidWeekAt(monday), monday)).toBe(0);
  });

  it('turns the day at midnight in São Paulo, not UTC', () => {
    // 2026-10-07T02:00Z is Tuesday 23:00 in São Paulo: today is still the 6th
    const now = new Date('2026-10-07T02:00:00Z');
    expect(studyStreak(['2026-10-05', '2026-10-06'], raidWeekAt(now), now)).toBe(2);
  });
});

describe('raidWeekDayKeys', () => {
  it('lists Monday to Sunday in São Paulo days', () => {
    expect(raidWeekDayKeys(raidWeekAt(new Date('2026-10-07T15:00:00Z')))).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
  });
});
